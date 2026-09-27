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

/** Pide a la app de escritorio la lista de AppIDs de Steam instalados localmente. */
export function requestInstalledSteamGames(timeoutMs = 3500): Promise<string[]> {
  const win = window as unknown as {
    __gamenowInstalledSteamApps?: string[];
    __gamenowSetInstalledSteamApps?: (apps: string[]) => void;
  };

  // 1. Si ya se han recibido desde el WebView host en memoria
  if (Array.isArray(win.__gamenowInstalledSteamApps) && win.__gamenowInstalledSteamApps.length > 0) {
    return Promise.resolve(win.__gamenowInstalledSteamApps);
  }

  // 2. Si están guardados en localStorage
  try {
    const raw = localStorage.getItem("gamenow_installed_steam_appids");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        win.__gamenowInstalledSteamApps = parsed;
        return Promise.resolve(parsed);
      }
    }
  } catch {}

  const host = (window as unknown as { chrome?: { webview?: WebViewHost } }).chrome?.webview;
  if (!host) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      resolve(win.__gamenowInstalledSteamApps || []);
    }, timeoutMs);

    win.__gamenowSetInstalledSteamApps = (apps) => {
      window.clearTimeout(timer);
      const cleanList = Array.isArray(apps) ? apps.map((x) => String(x).trim()).filter(Boolean) : [];
      win.__gamenowInstalledSteamApps = cleanList;
      try {
        localStorage.setItem("gamenow_installed_steam_appids", JSON.stringify(cleanList));
      } catch {}
      resolve(cleanList);
    };

    try {
      host.postMessage({ action: "get_installed_steam_games" });
    } catch {
      window.clearTimeout(timer);
      resolve([]);
    }
  });
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

    // Navegador estándar (Chrome, Edge, Firefox): usar enlace simulado y asignación directa de protocolo
    try {
      const a = document.createElement("a");
      a.href = `steam://rungameid/${cleanAppId}`;
      a.target = "_self";
      a.rel = "noreferrer";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        try {
          a.remove();
        } catch {}
      }, 1000);
    } catch {}

    try {
      window.location.assign(`steam://rungameid/${cleanAppId}`);
    } catch {
      window.location.href = `steam://rungameid/${cleanAppId}`;
    }

    return true;
  } catch {
    return false;
  }
}
