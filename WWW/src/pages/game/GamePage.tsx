import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../../data/CartContext";
import { fetchProduct, type StoreProduct } from "../../data/catalog";
import { StoreArt } from "../../data/StoreArt";
import { Footer9 } from "../Store/Footer9";
import { PageLoader } from "../Store/LogoLoader";
import { SiteNav } from "../Store/SiteNav";
import { StarRating } from "../Store/StarRating";
import { PcFitCard } from "./PcFitCard";
import { ReviewsSection } from "./ReviewsSection";
import "./GamePage.css";

export function GamePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!id) {
      setStatus("missing");
      return;
    }
    let alive = true;
    setStatus("loading");
    setActive(0);
    fetchProduct(id)
      .then((row) => {
        if (!alive) {
          return;
        }
        if (!row) {
          setStatus("missing");
          return;
        }
        setProduct(row);
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
  }, [id]);

  const gallery = useMemo(() => {
    if (!product) {
      return [];
    }
    if (product.gallery?.length) {
      return product.gallery;
    }
    if (!product.cover) {
      return [];
    }
    return [
      {
        type: "image" as const,
        src: product.cover,
        srcSet: product.coverSrcSet,
        sizes: product.coverSizes,
        alt: product.alt,
      },
    ];
  }, [product]);

  const current = gallery[active] ?? gallery[0];
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video || current?.type !== "video") {
      return;
    }
    const src = current.sources?.[0]?.src || current.src;
    const hlsStream = src.includes(".m3u8");
    video.muted = false;
    video.volume = 1;
    if (hlsStream && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
      return () => hls.destroy();
    }
    void video.play().catch(() => undefined);
  }, [current]);

  return (
    <div className="store">
      <SiteNav />
      <main className="game-page">
        {status === "loading" ? <PageLoader label="Cargando ficha…" /> : null}
        {status === "error" ? (
          <p role="alert">No se pudo cargar este juego. Inténtalo de nuevo.</p>
        ) : null}
        {status === "missing" ? <p>No encontramos ese título.</p> : null}
        {status === "ready" && product ? (
          <div className="game-layout">
            {current ? (
              <section className="game-media" aria-label="Medios">
                <div className="game-hero">
                  {current.type === "video" ? (
                    <video
                      key={current.src}
                      ref={heroVideoRef}
                      poster={current.poster}
                      controls
                      playsInline
                      preload="metadata"
                      muted={false}
                    >
                      {(current.src.includes(".m3u8")
                        ? []
                        : current.sources?.length
                          ? current.sources
                          : [{ src: current.src, type: current.src.endsWith(".webm") ? "video/webm" : "video/mp4" }]
                      ).map((source) => (
                        <source key={source.src} src={source.src} type={source.type} />
                      ))}
                    </video>
                  ) : (
                    <StoreArt
                      className="game-hero-art"
                      src={current.src}
                      srcSet={current.srcSet}
                      sizes={current.sizes ?? "(min-width: 900px) 56vw, 92vw"}
                      fallback={current.fallback}
                      alt={current.alt}
                    />
                  )}
                </div>
                {gallery.length > 1 ? (
                  <ul className="game-thumbs">
                    {gallery.map((item, index) => (
                      <li key={`${item.type}-${item.src}`}>
                        <button
                          type="button"
                          aria-current={index === active ? "true" : undefined}
                          aria-label={item.alt}
                          onClick={() => setActive(index)}
                        >
                          {item.type === "video" && item.src.includes(".m3u8") && item.poster ? (
                            <img className="game-thumb-preview" src={item.poster} alt="" />
                          ) : item.type === "video" ? (
                            <video
                              className="game-thumb-preview"
                              src={item.src}
                              poster={item.poster}
                              muted
                              playsInline
                              preload="metadata"
                              aria-hidden
                            />
                          ) : (
                            <StoreArt
                              src={item.src}
                              srcSet={item.srcSet}
                              sizes="96px"
                              fallback={item.fallback}
                              alt=""
                            />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            <section className="game-info" aria-labelledby="game-title">
              <p className="game-crumb">
                <Link to="/">Tienda</Link>
                <span aria-hidden> / </span>
                <Link to="/juegos">Nuestros Juegos</Link>
              </p>
              {product.studio ? <p className="game-studio">{product.studio}</p> : null}
              <h1 id="game-title">{product.name}</h1>
              {product.metacritic || product.steamRating ? (
                <p className="game-rating">
                  <StarRating score={product.metacritic ?? null} />
                  {product.steamRating ? <span>{product.steamRating}</span> : null}
                </p>
              ) : null}
              <p className="game-price">
                {product.was ? <s>{product.was}</s> : null}
                <span>{product.price}</span>
              </p>
              <button
                type="button"
                className="game-buy"
                onClick={() => {
                  add({
                    slug: product.slug,
                    name: product.name,
                    price: product.price,
                    priceValue: product.priceValue,
                    cover: product.cover,
                  });
                  navigate("/cart");
                }}
              >
                Añadir al carrito
              </button>
              {product.platforms ? <p className="game-meta">Plataformas: {product.platforms}</p> : null}
              <PcFitCard slug={product.slug} />
              {product.description ? <p className="game-copy">{product.description}</p> : null}
              {product.requirementsTable?.length ? (
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
                      {product.requirementsTable.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          <td>{row.min}</td>
                          <td>{row.max}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {product.requirementsNote ? <p className="game-reqs-note">{product.requirementsNote}</p> : null}
                </div>
              ) : null}
            </section>
            <ReviewsSection slug={product.slug} />
          </div>
        ) : null}
      </main>
      {status !== "loading" ? <Footer9 /> : null}
    </div>
  );
}
