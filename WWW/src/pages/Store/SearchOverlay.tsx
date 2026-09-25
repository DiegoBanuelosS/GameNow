import { useEffect, useId, useRef, useState } from "react";
import { MagnifyingGlass } from "../../components/Icons";
import { Link } from "react-router-dom";
import { apiUrl } from "../../data/api";
import type { CatalogGame } from "../../data/catalog";
import { StoreArt } from "../../data/StoreArt";
import { StarRating } from "./StarRating";
import { useSearchHits, useSearchMotion } from "./useStoreMotion";
import "./SearchOverlay.css";

export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useSearchMotion(open);
  const [query, setQuery] = useState("");
  const listRef = useSearchHits(query);
  const [matches, setMatches] = useState<CatalogGame[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    const needle = query.trim();
    if (!needle) {
      setMatches([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      fetch(apiUrl(`/api/games?q=${encodeURIComponent(needle)}&page=1`))
        .then((response) => (response.ok ? response.json() : { games: [] }))
        .then((payload: { games?: CatalogGame[] }) => {
          if (alive) setMatches((payload.games ?? []).slice(0, 8));
        })
        .catch(() => {
          if (alive) setMatches([]);
        });
    }, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  if (!open) {
    return null;
  }

  return (
    <div className="search-overlay" ref={overlayRef}>
      <button
        className="search-overlay-backdrop"
        type="button"
        onClick={onClose}
        aria-label="Cerrar búsqueda"
      />
      <div
        id="site-search"
        className="search-overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={inputId}
      >
        <div className="search-overlay-bar">
          <MagnifyingGlass size={22} weight="bold" aria-hidden />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={query}
            placeholder="Buscar juegos"
            autoComplete="off"
            aria-controls={listId}
            aria-expanded={matches.length > 0}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <ul id={listId} className="search-overlay-list" ref={listRef}>
          {!query.trim() ? (
            <li className="search-overlay-empty">Escribe el nombre de un juego.</li>
          ) : null}
          {query.trim() && !matches.length ? (
            <li className="search-overlay-empty">No hay juegos con ese nombre.</li>
          ) : null}
          {matches.map((game) => (
            <li key={game.slug}>
              <Link className="search-overlay-hit" to={game.href} onClick={onClose}>
                <StoreArt
                  className="search-overlay-cover"
                  src={game.cover}
                  srcSet={game.coverSrcSet}
                  sizes="64px"
                  fallback={game.coverFallback}
                  alt=""
                  width={64}
                  height={96}
                />
                <span>
                  <strong>{game.name}</strong>
                  <StarRating score={game.metacritic} size={14} />
                  <span className="search-overlay-price">
                    {game.was ? <s>{game.was}</s> : null} {game.price}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
