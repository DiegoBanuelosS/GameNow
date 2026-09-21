import { useEffect, useState } from "react";

export function checkIsDesktopApp(): boolean {
  if (typeof window === "undefined") return false;

  // 1. URL query param: ?app=1 or ?app=true
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("app") === "1" || params.get("app") === "true") {
      sessionStorage.setItem("gamenow_app", "1");
      return true;
    }
  } catch {}

  // 2. Session storage flag preserved across routes
  try {
    if (sessionStorage.getItem("gamenow_app") === "1") {
      return true;
    }
  } catch {}

  // 3. Microsoft Edge WebView2 native host object (injected by gamenow.exe WebView2)
  try {
    if (Boolean((window as unknown as { chrome?: { webview?: unknown } }).chrome?.webview)) {
      return true;
    }
  } catch {}

  // 4. Custom user agent or global app flag
  try {
    if (
      navigator.userAgent.includes("GameNow") ||
      Boolean((window as unknown as { __GAMENOW_APP__?: boolean }).__GAMENOW_APP__)
    ) {
      return true;
    }
  } catch {}

  return false;
}

export function useDesktopApp(): boolean {
  const [isApp, setIsApp] = useState(checkIsDesktopApp);

  useEffect(() => {
    setIsApp(checkIsDesktopApp());
  }, []);

  return isApp;
}
