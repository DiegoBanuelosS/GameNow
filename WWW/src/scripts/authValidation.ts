const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthFieldErrors = {
  email?: string;
  password?: string;
};

export function validateAuthForm(email: string, password: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = "Escribe tu correo.";
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = "Ese correo no tiene un formato válido.";
  }

  if (!password) {
    errors.password = "Escribe tu contraseña.";
  }

  return errors;
}
