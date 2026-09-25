const remoteApi = "https://gamenow-api.fly.dev";

export function apiUrl(path: string) {
  if (!path.startsWith("/api")) return path;
  return `${remoteApi}${path}`;
}
