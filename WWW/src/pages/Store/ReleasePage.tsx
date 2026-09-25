import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Link, useParams } from "react-router-dom";
import { apiUrl } from "../../data/api";
import { StoreArt } from "../../data/StoreArt";
import { ConnectionBanner } from "./ConnectionBanner";
import { Footer9 } from "./Footer9";
import { PageLoader } from "./LogoLoader";
import { SiteNav } from "./SiteNav";
import "../game/GamePage.css";

type SpecRow = { label: string; min: string; max: string };

type ReleaseAsset = {
  type: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
};

type ReleaseTitle = {
  appId: string;
  name: string;
  studio: string;
  cover: string;
  price: string;
  href: string;
  description: string;
  assets: ReleaseAsset[];
  specs: SpecRow[];
};

export function ReleasePage() {
  const { appId } = useParams();
  const [title, setTitle] = useState<ReleaseTitle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const [active, setActive] = useState(0);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!appId) {
      setStatus("missing");
      return;
    }
    let alive = true;
    setStatus("loading");
    setActive(0);
    fetch(apiUrl("/api/releases"), { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ days: { releases: ReleaseTitle[] }[] }>;
      })
      .then(async (payload) => {
        if (!alive) return;
        const match = payload.days.flatMap((day) => day.releases).find((item) => item.appId === appId);
        if (match) {
          setTitle(match);
          setStatus("ready");
          return;
        }
        const titleResponse = await fetch(apiUrl(`/api/title/${appId}`), { cache: "no-store" });
        if (!alive) return;
        if (!titleResponse.ok) {
          setTitle(null);
          setStatus("missing");
          return;
        }
        setTitle((await titleResponse.json()) as ReleaseTitle);
        setStatus("ready");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [appId]);

  const current = title?.assets[active] ?? title?.assets[0];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [appId]);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video || current?.type !== "video") return;
    const src = current.src;
    video.muted = false;
    video.volume = 1;
    if (src.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    if (src.includes(".m3u8")) video.src = src;
  }, [current]);

  return (
    <div className="store">
      <SiteNav />
      <main className="game-page">
        {status === "loading" ? <PageLoader label="Cargando ficha…" /> : null}
        {status === "error" ? (
          <ConnectionBanner
            title="No pudimos abrir este lanzamiento"
            detail="La ficha no está disponible ahora. Vuelve al calendario en unos minutos."
          />
        ) : null}
        {status === "missing" ? <p>No encontramos ese lanzamiento.</p> : null}
        {status === "ready" && title && current ? (
          <div className="game-layout">
            <section className="game-media" aria-label="Medios">
              <div className="game-hero">
                {current.type === "video" ? (
                  <video key={current.src} ref={heroVideoRef} poster={current.poster} controls playsInline preload="metadata">
                    {current.src.includes(".m3u8") ? null : (
                      <source src={current.src} type={current.src.includes(".webm") ? "video/webm" : "video/mp4"} />
                    )}
                  </video>
                ) : (
                  <StoreArt className="game-hero-art" src={current.src} alt={current.alt} />
                )}
              </div>
              {title.assets.length > 1 ? (
                <ul className="game-thumbs">
                  {title.assets.map((item, index) => (
                    <li key={`${item.type}-${item.src}`}>
                      <button
                        type="button"
                        aria-current={index === active ? "true" : undefined}
                        aria-label={item.type === "video" ? `Video de ${title.name}` : `Imagen ${index + 1} de ${title.name}`}
                        onClick={() => setActive(index)}
                      >
                        {item.type === "video" ? (
                          <img className="game-thumb-preview" src={item.poster || title.cover} alt="" />
                        ) : (
                          <StoreArt src={item.src} alt="" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
            <section className="game-info" aria-labelledby="release-title">
              <p className="game-crumb">
                <Link to="/">Tienda</Link>
                <span aria-hidden> / </span>
                <Link to="/#lanzamientos">Lanzamientos</Link>
              </p>
              {title.studio ? <p className="game-studio">{title.studio}</p> : null}
              <h1 id="release-title">{title.name}</h1>
              {title.price ? (
                <p className="game-price">
                  <span>{title.price}</span>
                </p>
              ) : null}
              {title.href.startsWith("/") ? (
                <Link className="game-buy" to={title.href}>
                  Ver ficha completa
                </Link>
              ) : null}
              {title.description ? <p className="game-copy">{title.description}</p> : null}
              {title.specs.length ? (
                <div className="game-reqs">
                  <h2>Requisitos</h2>
                  <table>
                    <caption>Comparación de requisitos mínimos y máximos de PC</caption>
                    <thead>
                      <tr>
                        <th scope="col">Componente</th>
                        <th scope="col">Mínimos</th>
                        <th scope="col">Máximos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {title.specs.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          <td>{row.min}</td>
                          <td>{row.max}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="game-copy">Este título todavía no publica requisitos de PC.</p>
              )}
            </section>
          </div>
        ) : null}
      </main>
      {status !== "loading" ? <Footer9 /> : null}
    </div>
  );
}
