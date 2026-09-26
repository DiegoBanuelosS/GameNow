type WebViewHost = {
  postMessage: (message: unknown) => void;
};

export function hasDesktopHost(): boolean {
  try {
    return Boolean((window as unknown as { chrome?: { webview?: WebViewHost } }).chrome?.webview);
  } catch {
    return false;
  }
}

/** Envía un toast al host de la app (Flutter) para mostrarlo con UI propia, sin toasts de Windows. */
export function notifyDesktopHost(toast: Record<string, unknown>): boolean {
  try {
    const host = (window as unknown as { chrome?: { webview?: WebViewHost } }).chrome?.webview;
    if (!host) return false;
    host.postMessage({ action: "notify", toast });
    return true;
  } catch {
    return false;
  }
}
