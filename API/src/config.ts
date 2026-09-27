import { resolve } from "node:path";

try {
  process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch (_) {}

const isProd = process.env.NODE_ENV === "production";
const defaultJwtSecret = "gamenow-ultra-secure-jwt-key-2026-auth-token-salt-xyz";
const rawJwtSecret = process.env.JWT_SECRET?.trim() || "";

if (isProd && (!rawJwtSecret || rawJwtSecret === defaultJwtSecret)) {
  console.error("ALERTA CRÍTICA DE SEGURIDAD: En producción DEBE definirse un JWT_SECRET robusto y único en las variables de entorno.");
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 8787),
  wwwOrigin: process.env.WWW_ORIGIN || "http://127.0.0.1:5173",
  mongoUri: process.env.MONGODB_URI?.trim() || "",
  mongoDb: process.env.MONGODB_DB || "gamenow",
  jwtSecret: rawJwtSecret || defaultJwtSecret,
  // Se carga al arrancar; si cambia, hay que reiniciar la API
  steamApiKey: process.env.STEAM_API_KEY?.trim() || "",
  cloudinary: {
    cloudName: process.env.Cloudinary_cloud_name || "",
    apiKey: process.env.Cloudinary_api_key || "",
    apiSecret: process.env.Cloudinary_api_secret || "",
  },
};

export function requireCloudinary() {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Faltan Cloudinary_cloud_name, Cloudinary_api_key o Cloudinary_api_secret en API/.env");
  }
  return { cloudName, apiKey, apiSecret };
}
