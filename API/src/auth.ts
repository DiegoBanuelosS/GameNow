import crypto from "node:crypto";
import { Router, Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { User, IUser } from "./models/User.js";

// ============================================================================
// 1. UTILIDADES CRIPTOGRÁFICAS DE MÁXIMA SEGURIDAD (OWASP / Zero-Dependency)
// ============================================================================

/**
 * Genera un hash seguro para la contraseña usando scrypt con sal aleatoria de 16 bytes.
 */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

/**
 * Compara una contraseña con su hash usando comparación de tiempo constante (evita Timing Attacks).
 */
export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parts = storedHash.split(":");
      if (parts.length !== 3 || parts[0] !== "scrypt") {
        return resolve(false);
      }
      const salt = parts[1];
      const originalKey = Buffer.from(parts[2], "hex");

      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) return resolve(false);
        if (originalKey.length !== derivedKey.length) return resolve(false);
        resolve(crypto.timingSafeEqual(originalKey, derivedKey));
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Codificación Base64Url para tokens JWT según RFC 7519
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Firma un token JWT estándar HS256 con expiración de 7 días.
 */
export function signJwt(user: IUser): string {
  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: String(user._id),
    email: user.email,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 días
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", config.jwtSecret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
}

/**
 * Verifica y decodifica un token JWT.
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac("sha256", config.jwtSecret)
      .update(data)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expirado
    }

    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// 2. LIMITADOR DE TASA / PROTECCIÓN CONTRA FUERZA BRUTA POR IP
// ============================================================================
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function rateLimitAuth(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = ipAttempts.get(ip);

  if (record && record.resetAt > now) {
    if (record.count >= 20) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.status(429).json({
        error: `Demasiadas solicitudes desde tu dirección IP. Por favor espera ${waitSeconds} segundos.`,
      });
      return;
    }
    record.count++;
  } else {
    ipAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 minutos
  }

  next();
}

// ============================================================================
// 3. VALIDACIÓN ESTRICTA DE CONTRASEÑA
// ============================================================================
export function validatePasswordStrength(password: string): string | null {
  if (!password || typeof password !== "string") {
    return "La contraseña es obligatoria.";
  }
  if (password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (password.length > 128) {
    return "La contraseña no puede exceder 128 caracteres.";
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra mayúscula.";
  }
  if (!/[a-z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra minúscula.";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return "La contraseña debe incluir al menos un carácter especial (ej. !@#$%&*).";
  }
  return null;
}

// ============================================================================
// 4. RUTAS DE AUTENTICACIÓN
// ============================================================================
export const authRouter = Router();

// Middleware de rate limit para prevenir ataques de fuerza bruta en registro/login
authRouter.use(rateLimitAuth);

/**
 * POST /api/auth/register
 * Registra un nuevo usuario con credenciales seguras.
 */
authRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const hasDb = await connectDb();
    if (!hasDb) {
      res.status(503).json({ error: "La base de datos no está disponible en este momento." });
      return;
    }

    const { username, email, password } = req.body;

    // Validación de campos obligatorios
    if (!username || typeof username !== "string" || username.trim().length < 3) {
      res.status(400).json({ error: "El nombre de usuario debe tener al menos 3 caracteres alfanuméricos." });
      return;
    }

    const cleanUsername = username.trim();
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      res.status(400).json({ error: "El nombre de usuario solo puede contener letras, números, guiones y puntos." });
      return;
    }

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "El correo electrónico es obligatorio." });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
      res.status(400).json({ error: "Ingresa un correo electrónico válido." });
      return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    // Verificar si el correo o el nombre de usuario ya están en uso
    const existing = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    }).lean();

    if (existing) {
      if (existing.email === cleanEmail) {
        res.status(409).json({ error: "Ya existe una cuenta registrada con este correo electrónico." });
        return;
      }
      if (existing.username.toLowerCase() === cleanUsername.toLowerCase()) {
        res.status(409).json({ error: "Ese nombre de usuario ya está ocupado. Elige otro." });
        return;
      }
    }

    // Hash seguro con scrypt
    const passwordHash = await hashPassword(password);

    const newUser = new User({
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      lastLogin: new Date(),
    });

    await newUser.save();

    const token = signJwt(newUser);

    res.status(201).json({
      user: newUser.toJSON(),
      token,
      message: "¡Cuenta creada con éxito!",
    });
  } catch (err: unknown) {
    console.error("Error en registro:", err);
    res.status(500).json({ error: "Ocurrió un error al procesar el registro. Intenta más tarde." });
  }
});

/**
 * POST /api/auth/login
 * Inicia sesión verificando hash y protegiendo contra bloqueos por fuerza bruta.
 */
authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const hasDb = await connectDb();
    if (!hasDb) {
      res.status(503).json({ error: "La base de datos no está disponible en este momento." });
      return;
    }

    const { email, password } = req.body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Ingresa tu correo y contraseña." });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Búsqueda por email o por nombre de usuario
    const user = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanEmail }],
    });

    if (!user) {
      // Mensaje genérico para evitar enumeración de usuarios
      res.status(401).json({ error: "Correo o contraseña incorrectos." });
      return;
    }

    // Comprobar bloqueo temporal de cuenta por demasiados intentos
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const waitMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
      res.status(423).json({
        error: `Tu cuenta ha sido bloqueada temporalmente por seguridad tras varios intentos fallidos. Intenta nuevamente en ${waitMinutes} minutos.`,
      });
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // Bloquear 15 minutos tras 5 intentos fallidos consecutivos
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await user.save();

      res.status(401).json({ error: "Correo o contraseña incorrectos." });
      return;
    }

    // Éxito: resetear intentos fallidos y actualizar fecha de último acceso
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    await user.save();

    const token = signJwt(user);

    res.json({
      user: user.toJSON(),
      token,
      message: "Sesión iniciada correctamente.",
    });
  } catch (err: unknown) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error al iniciar sesión. Intenta más tarde." });
  }
});

/**
 * GET /api/auth/me
 * Retorna los datos del usuario autenticado a partir del token JWT Bearer.
 */
authRouter.get("/me", async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No autorizado. Token no proporcionado." });
      return;
    }

    const token = authHeader.slice(7).trim();
    const payload = verifyJwt(token);

    if (!payload || !payload.sub) {
      res.status(401).json({ error: "Token inválido o expirado." });
      return;
    }

    const hasDb = await connectDb();
    if (!hasDb) {
      res.status(503).json({ error: "Base de datos no disponible." });
      return;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }

    res.json({ user: user.toJSON() });
  } catch (err: unknown) {
    console.error("Error en /auth/me:", err);
    res.status(500).json({ error: "Error al consultar usuario." });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post("/logout", (_req: Request, res: Response): void => {
  res.json({ ok: true, message: "Sesión cerrada correctamente." });
});
