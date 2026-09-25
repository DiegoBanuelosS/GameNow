import { Link } from "react-router-dom";
import { LiquidGlass } from "quick-liquid/react";
import { StoreArt } from "../../data/StoreArt";
import { useCatalog } from "../../data/CatalogContext";
import type { StoreProduct } from "../../data/catalog";
import { cyberpunkUltimateDeal } from "../../data/editions";
import { useHoverVideo } from "./useHoverVideo";
import "./EventOffers.css";

const CYBERPUNK = "cyberpunk-2077";
const CYBERPUNK_VIDEO = "/videos/cp.webm";
const CYBERPUNK_COVER = "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/library_600x900_2x.jpg";
const CYBERPUNK_EXTENDED = "https://res.cloudinary.com/fj6z6mba/image/upload/f_auto,q_auto:best,c_fill,g_center,w_1600,h_900/gamenow/presskit/cp-5th-1920";
const PHANTOM_LIBERTY_COVER = "https://res.cloudinary.com/fj6z6mba/image/upload/f_auto,q_auto:best,c_fill,g_auto,ar_2:3,w_600/gamenow/presskit/cp-phl-art";

/* Carátulas verticales 2:3 (referencia del grid); press kit landscape se evita */
const SIDE_COVERS: Record<string, string> = {
  "f1-2025-2026-season-pack": "/images/events/f126.webp",
  "nba-2k27": "/images/events/nba.webp",
  "forza-horizon-6": "/images/events/fh6.webp",
  "the-last-of-us-2-remastered": "/images/events/lst.webp",
  "arc-raiders": "https://cdn.akamai.steamstatic.com/steam/apps/1808500/library_600x900_2x.jpg",
  "007-first-light": "/images/events/007.webp",
};

function sideArt(game: StoreProduct) {
  const forced = SIDE_COVERS[game.slug];
  if (forced) {
    return { src: forced, srcSet: undefined as string | undefined, sizes: undefined as string | undefined };
  }
  // Fallback: Cloudinary en fill 2:3 para no dejar franjas
  const toPortrait = (url: string) => url.replace(/c_limit,g_center/g, "c_fill,g_auto,ar_2:3");
  return {
    src: toPortrait(game.cover),
    srcSet: game.coverSrcSet ? toPortrait(game.coverSrcSet) : undefined,
    sizes: game.coverSizes,
  };
}

function getDiscountBadge(game: StoreProduct): string | null {
  if (!game.was) return null;
  const wasNum = parseFloat(game.was.replace(/[^0-9.]/g, ""));
  if (wasNum && game.priceValue && wasNum > game.priceValue) {
    const pct = Math.round(((wasNum - game.priceValue) / wasNum) * 100);
    return `-${pct}%`;
  }
  return "-60%";
}

function CyberpunkFeature({ game }: { game: StoreProduct }) {
  const preview = useHoverVideo(CYBERPUNK_VIDEO, { audio: true });
  const deal = cyberpunkUltimateDeal(game);

  return (
    <article
      className={`cp-feature${preview.active ? " is-playing" : ""}`}
      onPointerEnter={preview.start}
      onPointerLeave={preview.stop}
    >
      <Link className="cp-feature-media" to={game.href}>
        <StoreArt className="cp-feature-art" src={CYBERPUNK_EXTENDED} sizes="(min-width: 1100px) 58vw, 92vw" alt="" />
        <video
          ref={preview.videoRef}
          className={`cp-feature-video${preview.active && preview.ready ? " is-on" : ""}`}
          loop
          playsInline
          preload="metadata"
          aria-hidden
          onError={preview.handleError}
          onLoadedMetadata={preview.handleMeta}
          onCanPlay={preview.handleCanPlay}
        />
        <div className="cp-feature-covers">
          <StoreArt className="cp-feature-cover is-game" src={CYBERPUNK_COVER} alt="Carátula de Cyberpunk 2077" />
          <span className="cp-feature-plus" aria-hidden="true">
            +
          </span>
          <StoreArt className="cp-feature-cover is-dlc" src={PHANTOM_LIBERTY_COVER} alt="Carátula de Phantom Liberty" />
        </div>
      </Link>
      <div className="cp-feature-meta">
        <h3 className="cp-feature-name">{game.name}</h3>
        <div className="offer-card-pricing">
          <span className="offer-discount-badge">-{deal.discountPct}%</span>
          <div className="offer-card-price-values">
            {deal.was ? <s>{deal.was}</s> : null}
            <span className="offer-card-price-current">{deal.price}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function GameTile({ game, size }: { game: StoreProduct; size: "large" | "small" }) {
  const discount = getDiscountBadge(game);
  const art = sideArt(game);

  return (
    <li className={`offer-item is-${size}`}>
      <Link className={`offer-card is-${size}`} to={game.href}>
        <StoreArt
          className="offer-card-art"
          src={art.src}
          srcSet={art.srcSet}
          sizes={art.sizes}
          alt={game.name}
        />
        <div className="offer-card-foot">
          {game.tag ? <p className="offer-card-tag">{game.tag}</p> : null}
          <p className="offer-card-name">{game.name}</p>
          <div className="offer-card-pricing">
            {discount ? <span className="offer-discount-badge">{discount}</span> : null}
            <div className="offer-card-price-values">
              {game.was ? <s>{game.was}</s> : null}
              <span className="offer-card-price-current">{game.price}</span>
            </div>
          </div>
        </div>
      </Link>

      <Link
        className={`offer-popout-info is-${size}`}
        to={game.href}
        aria-label={`Ver detalles de ${game.name}`}
      >
        <LiquidGlass
          className="offer-popout-glass"
          config={{
            appearance: "dark",
            material: "regular",
            borderRadius: 16,
            blur: 18,
            saturation: 1.6,
            refractionStrength: 22,
            chromaticAberration: 0.12,
            dynamicLighting: true,
          }}
        >
          <div className="offer-popout-copy">
            <div className="offer-popout-header">
              <div className="offer-popout-tags">
                {game.tag ? <span className="offer-popout-tag">{game.tag}</span> : null}
                {discount ? <span className="offer-discount-badge">{discount}</span> : null}
              </div>
              <h3 className="offer-popout-title">{game.name}</h3>
              {game.studio ? <p className="offer-popout-studio">{game.studio}</p> : null}
              {game.description ? <p className="offer-popout-desc">{game.description}</p> : null}
              {game.platforms ? (
                <p className="offer-popout-platforms">
                  <span>Plataformas:</span> {game.platforms}
                </p>
              ) : null}
            </div>
            <div className="offer-popout-footer">
              <div className="offer-popout-pricing">
                {discount ? <span className="offer-discount-badge">{discount}</span> : null}
                <div className="offer-popout-price-group">
                  {game.was ? <s className="offer-popout-was">{game.was}</s> : null}
                  <span className="offer-popout-price">{game.price}</span>
                </div>
              </div>
              <span className="offer-popout-btn">Ver ficha completa →</span>
            </div>
          </div>
        </LiquidGlass>
      </Link>
    </li>
  );
}

export function EventOffers() {
  const { catalog } = useCatalog();
  const cyberpunk =
    catalog.offers.find((game) => game.slug === CYBERPUNK) ||
    catalog.events.find((game) => game.slug === CYBERPUNK) ||
    catalog.ads.find((game) => game.slug === CYBERPUNK);
  const sideGames = [...catalog.events, ...catalog.offers]
    .filter(
      (game, index, list) =>
        game.slug !== "how-to-fish" &&
        game.slug !== CYBERPUNK &&
        Boolean(game.cover) &&
        list.findIndex((item) => item.slug === game.slug) === index,
    )
    .slice(0, 6);

  return (
    <section className="event-offers" id="eventos" aria-labelledby="event-offers-title">
      <h2 id="event-offers-title">Eventos y Ofertas</h2>

      <div className="event-offers-stage">
        {cyberpunk ? <CyberpunkFeature game={cyberpunk} /> : null}
        <ul className="event-offers-grid" aria-label="Ofertas">
          {sideGames.map((game) => (
            <GameTile key={game.slug} game={game} size="small" />
          ))}
        </ul>
      </div>
    </section>
  );
}
