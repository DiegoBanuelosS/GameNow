import { useEffect, useState } from "react";
import { fetchPcFit, type PcFit } from "../../data/catalog";
import { readPcProfile } from "../../data/pcProfile";
import "./PcFitCard.css";

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
        <p role="alert">No pudimos comprobar tu PC. Revisa que la API esté en marcha.</p>
      ) : null}
      {status === "ready" && fit ? (
        <>
          <p className="pc-fit-title">{fit.title}</p>
          <p>{fit.detail}</p>
          <p className="pc-fit-machine">{fit.machine}</p>
        </>
      ) : null}
    </section>
  );
}
