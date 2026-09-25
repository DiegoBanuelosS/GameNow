import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./AuthRequiredGate.css";

export type AuthGateFeature = {
  icon: ReactNode;
  label: string;
};

type AuthRequiredGateProps = {
  title: string;
  description: string;
  features?: AuthGateFeature[];
};

export function AuthRequiredGate({ title, description, features = [] }: AuthRequiredGateProps) {
  return (
    <main className="auth-required-gate">
      <div className="auth-required-card">
        <img
          src="/logotipes/micrologotipe.svg"
          alt="GameNow"
          width="64"
          height="64"
          className="auth-required-logo"
        />
        <h1 className="auth-required-title">{title}</h1>
        <p className="auth-required-desc">{description}</p>
        <div className="auth-required-actions">
          <Link to="/auth#iniciar" className="auth-required-btn-primary">
            Iniciar sesión
          </Link>
          <Link to="/auth#crear" className="auth-required-btn-secondary">
            Crear una cuenta nueva
          </Link>
        </div>
        {features.length > 0 ? (
          <div className="auth-required-features">
            {features.map((feature) => (
              <div key={feature.label} className="auth-required-feature-item">
                <span className="auth-required-feature-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
