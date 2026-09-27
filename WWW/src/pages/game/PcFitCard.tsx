import { useEffect, useState } from "react";
import { fetchPcFit, type PcFit } from "../../data/catalog";
import { readPcProfile } from "../../data/pcProfile";
import "./PcFitCard.css";

const FPS_SCALE = 144;

export function PcFitCard({ slug }: { slug: string }) {
  const [fit, setFit] = useState<PcFit | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    readPcProfile()
      .then((pc) => fetchPcFit(slug, pc))
      .then((row) => {
        if (!alive) {
          return;
        }
        setFit(row);
        setStatus("ready");
      })
      .catch(() => {
        if (alive) {
          setStatus("error");
        }
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <section className={`pc-fit is-${fit?.verdict ?? "unknown"}`} aria-live="polite">
      <h2>¿Corre en tu PC?</h2>
      {status === "loading" ? <p>Comprobando tu equipo…</p> : null}
      {status === "error" ? (
        <p role="alert">No pudimos comprobar tu equipo en este momento.</p>
      ) : null}
      {status === "ready" && fit ? (
        <>
          <p className="pc-fit-title">{fit.title}</p>
          {fit.fps && fit.quality ? (
            <div className="pc-fit-stats">
              <div>
                <span>FPS esperados</span>
                <strong>{fit.fps.min > FPS_SCALE ? `+${FPS_SCALE}` : `${fit.fps.min}–${fit.fps.max}`}</strong>
              </div>
              <div>
                <span>Calidad recomendada</span>
                <strong>{fit.quality}</strong>
              </div>
              <div>
                <span>Resolución</span>
                <strong>{fit.resolution}</strong>
              </div>
            </div>
          ) : null}
          <p>{fit.detail}</p>
          {fit.presets?.length ? (
            <ul className="pc-fit-presets" aria-label={`FPS estimados por calidad a ${fit.resolution}`}>
              {fit.presets.map((preset) => (
                <li key={preset.quality} className={preset.quality === fit.quality ? "is-picked" : undefined}>
                  <span>{preset.quality}</span>
                  <span className="pc-fit-bar" aria-hidden>
                    <span
                      className={preset.fps >= 60 ? "is-smooth" : preset.fps >= 30 ? "is-playable" : "is-low"}
                      style={{ width: `${Math.min(100, (preset.fps / FPS_SCALE) * 100)}%` }}
                    />
                  </span>
                  <span>{preset.fps} FPS</span>
                </li>
              ))}
            </ul>
          ) : null}
          {fit.notes?.length ? (
            <ul className="pc-fit-notes">
              {fit.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          <p className="pc-fit-machine">{fit.machine}</p>
          {fit.fps ? (
            <p className="pc-fit-disclaimer">
              Estimación a partir de los requisitos publicados y tu hardware; el rendimiento real varía según la zona del juego y los drivers.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
