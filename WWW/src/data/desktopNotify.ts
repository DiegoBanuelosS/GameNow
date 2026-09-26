import { checkIsDesktopApp } from "./useDesktopApp";

type DesktopNotifyPayload = {
  title: string;
  body: string;
  icon?: string;
};

type WebViewHost = {
  postMessage: (message: unknown) => void;
};

function webviewHost(): WebViewHost | null {
  try {
    const chromeObj = (window as unknown as { chrome?: { webview?: WebViewHost } }).chrome;
    return chromeObj?.webview ?? null;
  } catch {
    return null;
  }
}

function payloadForKind(kind: string, data: Record<string, string>): DesktopNotifyPayload {
  switch (kind) {
    case "friend-request":
      return {
        title: "Nueva solicitud de amistad",
        body: data.name || "Alguien quiere ser tu amigo",
        icon: data.avatarUrl || "",
      };
    case "game-downloaded":
      return {
        title: data.name || "Juego",
        body: "Descargado",
        icon: data.cover || "",
      };
    case "game-ready":
      return {
        title: data.name || "Juego",
        body: "Listo para jugar",
        icon: data.cover || "",
      };
    case "message":
      return {
        title: data.name || "Mensaje",
        body: data.text || "",
        icon: data.avatarUrl || "",
      };
    default:
      return { title: "GameNow", body: data.text || "" };
  }
}

async function showBrowserNotification(payload: DesktopNotifyPayload) {
  if (typeof Notification === "undefined") return;
  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return;
    const note = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/logotipes/micrologotipe.svg",
      silent: false,
    });
    window.setTimeout(() => note.close(), 8_000);
  } catch {
    /* WebView o permiso denegado */
  }
}

/** Notificación nativa de Windows cuando corre dentro de la app (WebView2 / Flutter). */
export function notifyDesktop(kind: string, data: Record<string, string>) {
  if (!checkIsDesktopApp()) return;
  const payload = payloadForKind(kind, data);
  if (!payload.body && !payload.title) return;

  const host = webviewHost();
  if (host) {
    try {
      host.postMessage({
        action: "notify",
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "",
      });
      return;
    } catch {
      /* caer al Notification API */
    }
  }

  void showBrowserNotification(payload);
}
