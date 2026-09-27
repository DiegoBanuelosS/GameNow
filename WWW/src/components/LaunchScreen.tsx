import { useEffect, useState } from "react";
import { LogoLoader } from "../pages/Store/LogoLoader";
import { useLaunch } from "../data/LaunchContext";
import { launchSteamGame } from "../data/desktopNotify";
import "./LaunchScreen.css";

export function LaunchScreen() {
  const { launch, stopLaunch, failLaunch } = useLaunch();
  const art = launch?.images?.length ? launch.images : launch?.image ? [launch.image] : [];
  const [artIndex, setArtIndex] = useState(0);
  const src = art[artIndex] || "";
  const [steamLaunched, setSteamLaunched] = useState(false);

  useEffect(() => {
    setArtIndex(0);
    setSteamLaunched(false);
  }, [launch]);

  useEffect(() => {
    if (!launch) return;

    if (launch.steamAppId) {
      // Lanzar juego a través de Steam (protocolo / launcher de escritorio)
      launchSteamGame(launch.steamAppId, launch.name);

      const successTimer = window.setTimeout(() => {
        setSteamLaunched(true);
      }, 1500);

      // Auto-retornar tras confirmar el lanzamiento a Steam
      const closeTimer = window.setTimeout(() => {
        stopLaunch();
      }, 4200);

      return () => {
        window.clearTimeout(successTimer);
        window.clearTimeout(closeTimer);
      };
    }

    // Los juegos propios de GameNow son demostrativos y no tienen binario ejecutable
    const nativeTimer = window.setTimeout(() => {
      failLaunch(
        "Los títulos del catálogo propio de GameNow son demostrativos y no cuentan con binarios ejecutables locales. Puedes ejecutar cualquier título vinculado con Steam.",
      );
    }, 2800);

    return () => window.clearTimeout(nativeTimer);
  }, [launch, failLaunch, stopLaunch]);

  if (!launch) return null;

  const nextArt = () => setArtIndex((index) => (index + 1 < art.length ? index + 1 : index));

  return (
    <div className="launch-screen" role="status" aria-live="polite" aria-label={`Iniciando ${launch.name}`}>
      {src ? (
        <>
          <img className="launch-screen-art" src={src} alt="" decoding="async" fetchPriority="high" onError={nextArt} />
          <div className="launch-screen-fade" aria-hidden="true">
            <img className="launch-screen-art launch-screen-art-blur" src={src} alt="" decoding="async" />
          </div>
        </>
      ) : null}
      <button type="button" className="launch-screen-back" onClick={stopLaunch}>
        Volver a mi biblioteca
      </button>
      <div className="launch-screen-status">
        {launch.steamAppId ? (
          <div>
            <p style={{ fontWeight: 600 }}>
              {steamLaunched
                ? `¡Petición enviada a Steam con éxito!`
                : `Iniciando ${launch.name} a través de Steam...`}
            </p>
            <p style={{ fontSize: "12px", color: "rgba(236, 231, 222, 0.75)", marginTop: "2px" }}>
              {steamLaunched
                ? "Tu cliente de Steam se está encargando de ejecutar el juego."
                : `Conectando con el protocolo de Steam (AppID ${launch.steamAppId})...`}
            </p>
          </div>
        ) : (
          <div>
            <p>Iniciando {launch.name}...</p>
            <p style={{ fontSize: "12px", color: "rgba(236, 231, 222, 0.75)", marginTop: "2px" }}>
              Verificando entorno de ejecución local...
            </p>
          </div>
        )}
        <LogoLoader />
      </div>
    </div>
  );
}
