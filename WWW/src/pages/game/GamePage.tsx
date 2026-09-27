import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Check } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../data/AuthContext";
import { useCart, type CartItem } from "../../data/CartContext";
import { fetchProduct, type StoreProduct } from "../../data/catalog";
import {
  buildBuyEditions,
  buildDlcs,
  formatEditionMoney,
  ownedEdition,
  upgradePrice,
  type GameEdition,
} from "../../data/editions";
import { StoreArt } from "../../data/StoreArt";
import { youtubeEmbed, youtubeId, youtubePoster } from "../../data/youtube";
import { ConnectionBanner } from "../Store/ConnectionBanner";
import { Footer9 } from "../Store/Footer9";
import { PageLoader } from "../Store/LogoLoader";
import { SiteNav } from "../Store/SiteNav";
import { StarRating } from "../Store/StarRating";
import { PcFitCard } from "./PcFitCard";
import { ReviewsSection } from "./ReviewsSection";
import "./GamePage.css";

type EditionState =
  | { kind: "buy" }
  | { kind: "owned" }
  | { kind: "included"; by: string }
  | { kind: "upgrade"; price: number };

function editionState(
  games: { slug: string; edition?: string }[] | undefined,
  product: StoreProduct,
  edition: GameEdition,
): EditionState {
  if (edition.kind === "dlc") {
    return (games ?? []).some((game) => game.slug === `${product.slug}:${edition.id}`)
      ? { kind: "owned" }
      : { kind: "buy" };
  }
  const owned = ownedEdition(games, product);
  if (!owned) return { kind: "buy" };
  if (owned.id === edition.id) return { kind: "owned" };
  if (edition.rank <= owned.rank) return { kind: "included", by: owned.name };
  return { kind: "upgrade", price: upgradePrice(edition, owned) };
}

function EditionOffer({
  product,
  edition,
  state,
  add,
  onBought,
}: {
  product: StoreProduct;
  edition: GameEdition;
  state: EditionState;
  add: (item: CartItem) => void;
  onBought: () => void;
}) {
  const upgrade = state.kind === "upgrade";
  const price = upgrade ? formatEditionMoney(product, state.price) : edition.price;
  return (
    <li className="game-edition">
      <StoreArt className="game-edition-cover" src={edition.cover} alt="" />
      <p className="game-edition-name">
        {edition.name}
        {state.kind === "included" ? <small>Incluida en tu {state.by}</small> : null}
        {upgrade ? <small>Pagas solo la diferencia</small> : null}
      </p>
      {state.kind === "buy" || upgrade ? (
        <div className="game-edition-price">
          {upgrade ? <s>{edition.price}</s> : edition.was ? <s>{edition.was}</s> : null}
          <span>{price}</span>
        </div>
      ) : null}
      {state.kind === "owned" ? (
        <button type="button" className="game-edition-buy is-owned" disabled>
          <Check size={16} aria-hidden />
          Comprado
        </button>
      ) : state.kind === "included" ? (
        <button type="button" className="game-edition-buy is-included" disabled>
          Incluido
        </button>
      ) : (
        <button
          type="button"
          className={upgrade ? "game-edition-buy is-upgrade" : "game-edition-buy"}
          onClick={() => {
            add({
              slug: `${product.slug}:${edition.id}`,
              name: upgrade ? `${product.name} — Mejora a ${edition.name}` : `${product.name} — ${edition.name}`,
              price,
              priceValue: upgrade ? state.price : edition.priceValue,
              cover: edition.cover,
            });
            onBought();
          }}
        >
          {upgrade ? `Mejorar a ${edition.name}` : "Comprar"}
        </button>
      )}
    </li>
  );
}

export function GamePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const { user } = useAuth();
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
    const raw =
      product.gallery?.length
        ? product.gallery
        : product.cover
          ? [
              {
                type: "image" as const,
                src: product.cover,
                srcSet: product.coverSrcSet,
                sizes: product.coverSizes,
                alt: product.alt,
              },
            ]
          : [];
    // Sin carátulas: solo tráilers y capturas de gameplay.
    return raw.filter((item) => {
      if (item.type !== "image") return true;
      if (item.src === product.cover) return false;
      if (
        /library_600x900|\/cover|_cover|ar_2:3|capsule_616x353|capsule_231x87|cp-phl-art|cyberpunk-2077-cover|cp-liberty|cp-home|CP2077_UE_KV|nba-2k27-cover-reveal|header\.jpg/i.test(
          item.src,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [product]);

  const buyEditions = useMemo(() => (product ? buildBuyEditions(product) : []), [product]);
  const dlcs = useMemo(() => (product ? buildDlcs(product) : []), [product]);

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
          <ConnectionBanner
            title="No pudimos abrir este juego"
            detail="La ficha no está disponible ahora. Vuelve a la tienda en unos minutos."
          />
        ) : null}
        {status === "missing" ? <p>No encontramos ese título.</p> : null}
        {status === "ready" && product ? (
          <div className="game-layout">
            {current || dlcs.length ? (
              <section className="game-media" aria-label="Medios">
                {current ? (
                  <>
                    <div className="game-hero">
                      {current.type === "video" && youtubeId(current.src) ? (
                        <iframe
                          key={current.src}
                          className="game-hero-frame"
                          src={youtubeEmbed(youtubeId(current.src), { muted: true, controls: true })}
                          title={current.alt}
                          allow="autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      ) : current.type === "video" ? (
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
                              {item.type === "video" && youtubeId(item.src) ? (
                                <img className="game-thumb-preview" src={youtubePoster(youtubeId(item.src))} alt="" />
                              ) : item.type === "video" && item.src.includes(".m3u8") && item.poster ? (
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
                  </>
                ) : null}
                {dlcs.length ? (
                  <div className="game-dlcs">
                    <h2 id="game-dlcs-title">DLCs</h2>
                    <ul className="game-editions" aria-labelledby="game-dlcs-title">
                      {dlcs.map((edition) => (
                        <EditionOffer
                          key={edition.id}
                          product={product}
                          edition={edition}
                          state={editionState(user?.steamGames, product, edition)}
                          add={add}
                          onBought={() => navigate("/cart")}
                        />
                      ))}
                    </ul>
                  </div>
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
              {product.priceValue > 0 ? null : (
                <p className="game-unavailable">
                  {product.price === "Gratis"
                    ? "Este juego es gratuito en Steam; no se vende en GameNow."
                    : "Este juego no está a la venta en este momento."}
                </p>
              )}
              <ul className="game-editions" aria-label="Ediciones">
                {(product.priceValue > 0 ? buyEditions : []).map((edition) => (
                  <EditionOffer
                    key={edition.id}
                    product={product}
                    edition={edition}
                    state={editionState(user?.steamGames, product, edition)}
                    add={add}
                    onBought={() => navigate("/cart")}
                  />
                ))}
              </ul>
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
