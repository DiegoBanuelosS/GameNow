import { CSSProperties, FormEvent, useId, useState } from "react";
import { X } from "../../components/Icons";
import { Link } from "react-router-dom";
import { useCatalog } from "../../data/CatalogContext";
import { StoreArt } from "../../data/StoreArt";
import { validateAuthForm } from "../../scripts/authValidation";
import "./AuthPage.css";

export function AuthPage() {
  const emailId = useId();
  const passwordId = useId();
  const formErrorId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { catalog } = useCatalog();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecoveryNote(null);

    const nextErrors = validateAuthForm(email, password);
    setFieldErrors(nextErrors);

    if (nextErrors.email || nextErrors.password) {
      setFormError(null);
      return;
    }

    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      setFormError("No pudimos iniciar sesión. Revisa el correo y la contraseña.");
    }, 700);
  }

  function handleRecovery() {
    setFormError(null);
    setRecoveryNote(
      "Si hay una cuenta con ese correo, te enviaremos instrucciones.",
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
        <Link className="auth-close auth-enter" style={{ "--enter": 0 } as CSSProperties} to="/" aria-label="Cerrar e ir al inicio">
          <X size={28} weight="bold" aria-hidden="true" />
        </Link>
      </header>

      <main className="auth-main">
        <section className="auth-form-panel" aria-labelledby="auth-title">
          <div className="auth-form-inner">
            <h1 id="auth-title" className="auth-enter" style={{ "--enter": 1 } as CSSProperties}>
              Inicia sesión
            </h1>
            <p className="auth-lead auth-enter" style={{ "--enter": 2 } as CSSProperties}>
              the core of gaming - Gamenow
            </p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {formError ? (
                <p className="auth-banner" id={formErrorId} role="alert">
                  {formError}
                </p>
              ) : null}

              {recoveryNote ? (
                <p className="auth-banner auth-banner-info" role="status">
                  {recoveryNote}
                </p>
              ) : null}

              <div className="field auth-enter" style={{ "--enter": 3 } as CSSProperties}>
                <label htmlFor={emailId}>Correo</label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((current) => ({ ...current, email: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                />
                {fieldErrors.email ? (
                  <p className="field-error" id={emailErrorId} role="alert">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="field auth-enter" style={{ "--enter": 4 } as CSSProperties}>
                <label htmlFor={passwordId}>Contraseña</label>
                <div className="field-control">
                  <input
                    id={passwordId}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((current) => ({ ...current, password: undefined }));
                      }
                    }}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
                  />
                  <button
                    className="field-reveal"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="field-error" id={passwordErrorId} role="alert">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>

              <button
                className="auth-submit auth-enter"
                style={{ "--enter": 5 } as CSSProperties}
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando…" : "Iniciar sesión"}
              </button>

              <button
                className="auth-recover auth-enter"
                style={{ "--enter": 6 } as CSSProperties}
                type="button"
                onClick={handleRecovery}
              >
                Olvidé mi contraseña
              </button>
            </form>
          </div>

          <p className="auth-signup auth-enter auth-enter-center" style={{ "--enter": 7 } as CSSProperties}>
            ¿No tienes cuenta?{" "}
            <a href="/auth#crear">Crea una</a>
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
