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

let desktopPc: Promise<Record<string, unknown> | null> | null = null;

/** Pide a la app de escritorio el hardware real (CPU, GPU y RAM que el navegador no expone). */
export function requestDesktopPc(timeoutMs = 4000): Promise<Record<string, unknown> | null> {
  if (desktopPc) return desktopPc;
  const host = (window as unknown as { chrome?: { webview?: WebViewHost } }).chrome?.webview;
  if (!host) return Promise.resolve(null);
  const unsupportedKey = "gamenow_pc_bridge_unsupported";
  try {
    if (sessionStorage.getItem(unsupportedKey)) return Promise.resolve(null);
  } catch {}
  desktopPc = new Promise((resolve) => {
    const target = window as unknown as { __gamenowPcSpecs?: (specs: Record<string, unknown>) => void };
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(unsupportedKey, "1");
      } catch {}
      desktopPc = null;
      resolve(null);
    }, timeoutMs);
    target.__gamenowPcSpecs = (specs) => {
      window.clearTimeout(timer);
      resolve(specs && typeof specs === "object" ? specs : null);
    };
    try {
      host.postMessage({ action: "pc" });
    } catch {
      window.clearTimeout(timer);
      desktopPc = null;
      resolve(null);
    }
  });
  return desktopPc;
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

/** Solicita al launcher de escritorio (Flutter) o al navegador ejecutar un juego de Steam vía protocolo. */
export function launchSteamGame(steamAppId: string, name?: string): boolean {
  try {
    const cleanAppId = steamAppId.replace(/[^0-9]/g, "");
    if (!cleanAppId) return false;

    const host = (window as unknown as { chrome?: { webview?: WebViewHost } }).chrome?.webview;
    if (host) {
      host.postMessage({
        action: "launch_steam",
        steamAppId: cleanAppId,
        name: name || `Steam App ${cleanAppId}`,
      });
      return true;
    }

    // Fallback seguro para navegador web convencional: invocar protocolo steam:// en iframe oculto
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `steam://rungameid/${cleanAppId}`;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      try {
        iframe.remove();
      } catch {}
    }, 2000);
    return true;
  } catch {
    return false;
  }
}
