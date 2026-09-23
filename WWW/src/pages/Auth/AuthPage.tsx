import { CSSProperties, FormEvent, useEffect, useId, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { X } from "../../components/Icons";
import { useCatalog } from "../../data/CatalogContext";
import { useAuth } from "../../data/AuthContext";
import { StoreArt } from "../../data/StoreArt";
import { checkIsDesktopApp } from "../../data/useDesktopApp";
import "./AuthPage.css";

interface AuthPageProps {
  isMandatory?: boolean;
}

export function AuthPage({ isMandatory = false }: AuthPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { catalog } = useCatalog();
  const { login, register, status } = useAuth();
  const isDesktop = checkIsDesktopApp() || isMandatory;

  // Modos: 'login' o 'register'
  const [mode, setMode] = useState<"login" | "register">(() => {
    return location.hash === "#crear" ? "register" : "login";
  });

  useEffect(() => {
    if (location.hash === "#crear") {
      setMode("register");
    } else if (location.hash === "#iniciar") {
      setMode("login");
    }
  }, [location.hash]);

  // Si ya está autenticado, redirigir a la tienda
  useEffect(() => {
    if (status === "authenticated") {
      navigate("/", { replace: true });
    }
  }, [status, navigate]);

  // IDs para accesibilidad
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const formErrorId = useId();

  // Estados de formulario
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verificación de requisitos de contraseña
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMsg(null);
    setRecoveryNote(null);

    // Validación según modo
    if (mode === "register") {
      if (!username.trim() || username.trim().length < 3) {
        setFormError("El nombre de usuario debe tener al menos 3 caracteres.");
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
        setFormError("El nombre de usuario solo puede tener letras, números, guiones y puntos.");
        return;
      }
      if (!email.trim() || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
        setFormError("Por favor ingresa un correo electrónico válido.");
        return;
      }
      if (!isPasswordValid) {
        setFormError("La contraseña no cumple con todos los requisitos de seguridad.");
        return;
      }
      if (password !== confirmPassword) {
        setFormError("Las contraseñas no coinciden.");
        return;
      }

      setIsSubmitting(true);
      const res = await register(username.trim(), email.trim(), password);
      setIsSubmitting(false);

      if (!res.ok) {
        setFormError(res.error || "No se pudo crear la cuenta.");
      } else {
        setSuccessMsg("¡Cuenta creada exitosamente! Entrando a GameNow…");
        setTimeout(() => navigate("/", { replace: true }), 400);
      }
    } else {
      // Modo login
      if (!email.trim()) {
        setFormError("Ingresa tu correo electrónico o usuario.");
        return;
      }
      if (!password) {
        setFormError("Ingresa tu contraseña.");
        return;
      }

      setIsSubmitting(true);
      const res = await login(email.trim(), password);
      setIsSubmitting(false);

      if (!res.ok) {
        setFormError(res.error || "No se pudo iniciar sesión.");
      } else {
        setSuccessMsg("¡Sesión iniciada! Entrando a GameNow…");
        setTimeout(() => navigate("/", { replace: true }), 400);
      }
    }
  }

  function handleRecovery() {
    setFormError(null);
    setRecoveryNote(
      "Si existe una cuenta asociada a ese correo, te enviaremos las instrucciones de recuperación.",
    );
  }

  return (
    <div className="auth">
      <header className="auth-header">
        <Link className="brand" to="/">
          <img
            className="brand-logo"
            src="/logotipes/logotipe-mark.svg"
            alt="GameNow"
            width="281"
            height="154"
          />
        </Link>
        {/* En la Desktop App se oculta la X para forzar el inicio de sesión */}
        {!isDesktop && (
          <Link
            className="auth-close auth-enter"
            style={{ "--enter": 0 } as CSSProperties}
            to="/"
            aria-label="Cerrar e ir al inicio"
          >
            <X size={28} weight="bold" aria-hidden="true" />
          </Link>
        )}
      </header>

      <main className="auth-main">
        <section className="auth-form-panel" aria-labelledby="auth-title">
          <div className="auth-form-inner">
            <h1 id="auth-title" className="auth-enter" style={{ "--enter": 1 } as CSSProperties}>
              {mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}
            </h1>
            <p className="auth-lead auth-enter" style={{ "--enter": 2 } as CSSProperties}>
              the core of gaming - Gamenow
            </p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {formError && (
                <p className="auth-banner" id={formErrorId} role="alert">
                  {formError}
                </p>
              )}

              {successMsg && (
                <p className="auth-banner auth-banner-info" role="status">
                  {successMsg}
                </p>
              )}

              {recoveryNote && (
                <p className="auth-banner auth-banner-info" role="status">
                  {recoveryNote}
                </p>
              )}

              {/* Campo Usuario (solo en registro) */}
              {mode === "register" && (
                <div className="field auth-enter" style={{ "--enter": 3 } as CSSProperties}>
                  <label htmlFor={usernameId}>Nombre de usuario</label>
                  <input
                    id={usernameId}
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Ej. GamerPro_99"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Campo Correo */}
              <div className="field auth-enter" style={{ "--enter": 4 } as CSSProperties}>
                <label htmlFor={emailId}>
                  {mode === "login" ? "Correo o usuario" : "Correo electrónico"}
                </label>
                <input
                  id={emailId}
                  name="email"
                  type={mode === "login" ? "text" : "email"}
                  autoComplete={mode === "login" ? "username" : "email"}
                  placeholder={mode === "login" ? "tu@correo.com o usuario" : "tu@correo.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Campo Contraseña */}
              <div className="field auth-enter" style={{ "--enter": 5 } as CSSProperties}>
                <label htmlFor={passwordId}>Contraseña</label>
                <div className="field-control">
                  <input
                    id={passwordId}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    className="field-reveal"
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              {/* Lista de requisitos de seguridad de contraseña (en modo registro) */}
              {mode === "register" && password.length > 0 && (
                <div className="password-rules auth-enter" style={{ "--enter": 5 } as CSSProperties}>
                  <div className={`rule-item ${hasMinLength ? "valid" : ""}`}>
                    <span className="rule-icon">{hasMinLength ? "✓" : "•"}</span>
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div className={`rule-item ${hasUpper && hasLower ? "valid" : ""}`}>
                    <span className="rule-icon">{hasUpper && hasLower ? "✓" : "•"}</span>
                    <span>Mayúsculas y minúsculas</span>
                  </div>
                  <div className={`rule-item ${hasNumber ? "valid" : ""}`}>
                    <span className="rule-icon">{hasNumber ? "✓" : "•"}</span>
                    <span>Al menos un número</span>
                  </div>
                  <div className={`rule-item ${hasSpecial ? "valid" : ""}`}>
                    <span className="rule-icon">{hasSpecial ? "✓" : "•"}</span>
                    <span>Un carácter especial (!@#$%&*)</span>
                  </div>
                </div>
              )}

              {/* Confirmar contraseña (solo en registro) */}
              {mode === "register" && (
                <div className="field auth-enter" style={{ "--enter": 6 } as CSSProperties}>
                  <label htmlFor={confirmPasswordId}>Confirmar contraseña</label>
                  <input
                    id={confirmPasswordId}
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <button
                className="auth-submit auth-enter"
                style={{ "--enter": 7 } as CSSProperties}
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? mode === "login"
                    ? "Iniciando sesión…"
                    : "Creando cuenta…"
                  : mode === "login"
                  ? "Iniciar sesión"
                  : "Crear cuenta"}
              </button>

              {mode === "login" && (
                <button
                  className="auth-recover auth-enter"
                  style={{ "--enter": 8 } as CSSProperties}
                  type="button"
                  onClick={handleRecovery}
                >
                  Olvidé mi contraseña
                </button>
              )}
            </form>
          </div>

          <p className="auth-signup auth-enter auth-enter-center" style={{ "--enter": 9 } as CSSProperties}>
            {mode === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", font: "inherit" }}
                  onClick={() => {
                    setMode("register");
                    setFormError(null);
                  }}
                >
                  Crea una aquí
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes una cuenta?{" "}
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", font: "inherit" }}
                  onClick={() => {
                    setMode("login");
                    setFormError(null);
                  }}
                >
                  Inicia sesión aquí
                </button>
              </>
            )}
          </p>
        </section>

        <aside className="auth-visual">
          <StoreArt
            src={catalog.authPanel || "/images/auth-panel.webp"}
            srcSet={catalog.authPanelSrcSet}
            sizes="(min-width: 900px) 42vw, 100vw"
            alt="Sala en penumbra con un mando frente a una pantalla encendida."
            width={1024}
            height={1365}
          />
        </aside>
      </main>
    </div>
  );
}
