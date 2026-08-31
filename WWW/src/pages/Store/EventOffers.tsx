import { Link } from "react-router-dom";
import { StoreArt } from "../../data/StoreArt";
import { useCatalog } from "../../data/CatalogContext";
import type { StoreProduct } from "../../data/catalog";
import "./EventOffers.css";

function GameTile({ game, size }: { game: StoreProduct; size: "large" | "small" }) {
  return (
    <li>
      <Link className={`offer-card is-${size}`} to={game.href}>
        <StoreArt
          className="offer-card-art"
          src={game.cover}
          srcSet={game.coverSrcSet}
          sizes={game.coverSizes}
          alt=""
        />
        <div className="offer-card-foot">
          {game.tag ? <p className="offer-card-tag">{game.tag}</p> : null}
          <p className="offer-card-name">{game.name}</p>
          <p className="offer-card-price">
            {game.was ? <s>{game.was}</s> : null}
            <span>{game.price}</span>
          </p>
        </div>
      </Link>
    </li>
  );
}

export function EventOffers() {
  const { catalog, status } = useCatalog();

  return (
    <section className="event-offers" id="eventos" aria-labelledby="event-offers-title">
      <h2 id="event-offers-title">Eventos y Ofertas</h2>

      {status === "error" ? (
        <p className="store-status" role="alert">
          No se pudo cargar el catálogo. Revisa que la API esté en marcha.
        </p>
      ) : null}

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
