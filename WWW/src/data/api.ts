import { checkIsDesktopApp } from "./useDesktopApp";

const remoteApi = "https://gamenow-api.fly.dev";

export function apiUrl(path: string) {
  if (!path.startsWith("/api")) return path;
  const remote = !import.meta.env.DEV || checkIsDesktopApp();
  return remote ? `${remoteApi}${path}` : path;
}
