import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../../data/api";
import type { CatalogGame } from "../../data/catalog";
import { GamesPager } from "./GamesPager";
import { GamesTable } from "./GamesTable";
import "./GameTables.css";

const PAGE_SIZE = 10;

export function GameCatalog() {
  const [games, setGames] = useState<CatalogGame[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/games?page=${page}`))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ games: CatalogGame[]; total: number; pageCount: number }>;
      })
      .then((payload) => {
        if (!alive) return;
        setGames(payload.games.slice(0, PAGE_SIZE));
        setTotal(payload.total);
        setPageCount(payload.pageCount);
      })
      .catch(() => {
        if (alive) {
          setGames([]);
          setTotal(0);
        }
      });
    return () => {
      alive = false;
    };
  }, [page]);

  return (
    <section className="games-tables" aria-labelledby="games-tables-title">
      <div className="games-tables-head">
        <div>
          <h2 id="games-tables-title">Nuestros Juegos</h2>
          <p className="games-tables-lead">
            {total} títulos · Página {page} de {pageCount}
          </p>
        </div>
        <Link className="games-more" to="/juegos">
          Ver más
        </Link>
      </div>

      <GamesTable games={games} caption="Catálogo" layoutKey={`catalog-${page}`} />
      <GamesPager page={page} pageCount={pageCount} onPage={setPage} />
    </section>
  );
}
