import { Link } from "react-router-dom";
import { StoreArt } from "../../data/StoreArt";
import { useCatalog } from "../../data/CatalogContext";
import type { StoreProduct } from "../../data/catalog";
import "./EventOffers.css";

function getDiscountBadge(game: StoreProduct): string | null {
  if (!game.was) return null;
  const wasNum = parseFloat(game.was.replace(/[^0-9.]/g, ""));
  if (wasNum && game.priceValue && wasNum > game.priceValue) {
    const pct = Math.round(((wasNum - game.priceValue) / wasNum) * 100);
    return `-${pct}%`;
  }
  return "-60%";
}

function GameTile({ game, size }: { game: StoreProduct; size: "large" | "small" }) {
  const discount = getDiscountBadge(game);

  return (
    <li className={`offer-item is-${size}`}>
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

      {/* Info emergente a la derecha FUERA de la card con datos completos */}
      <Link
        className={`offer-popout-info is-${size}`}
        to={game.href}
        aria-label={`Ver detalles de ${game.name}`}
      >
        <div className="offer-popout-header">
          <div className="offer-popout-tags">
            {game.tag ? <span className="offer-popout-tag">{game.tag}</span> : null}
            {discount ? <span className="offer-discount-badge">{discount}</span> : null}
          </div>
          <h3 className="offer-popout-title">{game.name}</h3>
          {game.studio ? <p className="offer-popout-studio">{game.studio}</p> : null}
          {game.description ? (
            <p className="offer-popout-desc">{game.description}</p>
          ) : null}
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
      </Link>
    </li>
  );
}

export function EventOffers() {
  const { catalog } = useCatalog();

  return (
    <section className="event-offers" id="eventos" aria-labelledby="event-offers-title">
      <h2 id="event-offers-title">Eventos y Ofertas</h2>

      <div className="event-offers-board">
        <ul className="offer-featured" aria-label="Eventos">
          {catalog.events.map((game) => (
            <GameTile key={game.slug} game={game} size="large" />
          ))}
        </ul>

        <ul className="offer-side" aria-label="Ofertas">
          {catalog.offers.map((game) => (
            <GameTile key={game.slug} game={game} size="small" />
          ))}
        </ul>
      </div>
    </section>
  );
}
