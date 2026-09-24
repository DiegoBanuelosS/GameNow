import { useEffect, useState } from "react";
import { LogoLoader } from "../pages/Store/LogoLoader";
import { useLaunch } from "../data/LaunchContext";
import "./LaunchScreen.css";

const FAIL_AFTER_MS = 30_000;

export function LaunchScreen() {
  const { launch, stopLaunch, failLaunch } = useLaunch();
  const art = launch?.images?.length ? launch.images : launch?.image ? [launch.image] : [];
  const [artIndex, setArtIndex] = useState(0);
  const src = art[artIndex] || "";

  useEffect(() => {
    setArtIndex(0);
  }, [launch]);

  useEffect(() => {
    if (!launch) return;
    const timer = window.setTimeout(() => failLaunch(), FAIL_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [launch, failLaunch]);

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
        <p>Iniciando {launch.name}...</p>
        <LogoLoader />
      </div>
    </div>
  );
}
