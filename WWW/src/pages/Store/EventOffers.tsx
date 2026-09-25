import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { LiquidGlass } from "quick-liquid/react";
import { StoreArt } from "../../data/StoreArt";
import { useCatalog } from "../../data/CatalogContext";
import type { StoreProduct } from "../../data/catalog";
import { useHoverVideo } from "./useHoverVideo";
import "./EventOffers.css";

const CYBERPUNK = "cyberpunk-2077";
const CYBERPUNK_VIDEO = "/videos/cp.webm";
const CYBERPUNK_COVER = "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/library_600x900_2x.jpg";
const CYBERPUNK_EXTENDED = "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/library_hero_2x.jpg";
const PHANTOM_LIBERTY_COVER = "https://cdn.cloudflare.steamstatic.com/steam/apps/2138330/header.jpg";

function getDiscountBadge(game: StoreProduct): string | null {
  if (!game.was) return null;
  const wasNum = parseFloat(game.was.replace(/[^0-9.]/g, ""));
  if (wasNum && game.priceValue && wasNum > game.priceValue) {
    const pct = Math.round(((wasNum - game.priceValue) / wasNum) * 100);
    return `-${pct}%`;
  }
  return "-60%";
}

function saleMoney(sample: string, value: number) {
  const formatted = value.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return sample.replace(/[\d.,]+/, formatted);
}

function CyberpunkFeature({ game }: { game: StoreProduct }) {
  const preview = useHoverVideo(CYBERPUNK_VIDEO, { audio: true });
  const wasNum = parseFloat((game.was || "").replace(/[^0-9.]/g, ""));
  const sale = wasNum ? Math.round(wasNum * 0.2 * 100) / 100 : game.priceValue;
  const price = game.was ? saleMoney(game.was, sale) : game.price;

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
          <span className="offer-discount-badge">-80%</span>
          <div className="offer-card-price-values">
            {game.was ? <s>{game.was}</s> : null}
            <span className="offer-card-price-current">{price}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function GameTile({ game, size }: { game: StoreProduct; size: "large" | "small" }) {
  const discount = getDiscountBadge(game);
  const itemRef = useRef<HTMLLIElement>(null);

  useLayoutEffect(() => {
    const item = itemRef.current;
    const image = item?.querySelector("img");
    if (!item || !image) return;
    const apply = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      item.style.setProperty("--cover-ratio", `${image.naturalWidth} / ${image.naturalHeight}`);
    };
    if (image.complete) apply();
    else image.addEventListener("load", apply, { once: true });
    return () => image.removeEventListener("load", apply);
  }, [game.cover]);

  return (
    <li ref={itemRef} className={`offer-item is-${size}`}>
      <Link className={`offer-card is-${size}`} to={game.href}>
        <StoreArt
          className="offer-card-art"
          src={game.cover}
          srcSet={game.coverSrcSet}
          sizes={game.coverSizes}
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
