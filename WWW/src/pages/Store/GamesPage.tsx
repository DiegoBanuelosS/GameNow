import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCatalog } from "../../data/CatalogContext";
import {
  filterGames,
  isGameTab,
  priceCeiling,
  type GameFilterState,
} from "../../data/gameFilters";
import { Footer9 } from "./Footer9";
import { GamesPager } from "./GamesPager";
import { GamesSidebar } from "./GamesSidebar";
import { GamesTable } from "./GamesTable";
import { PageLoader } from "./LogoLoader";
import { SiteNav } from "./SiteNav";
import { useStoreEnter } from "./useStoreMotion";
import "./GameTables.css";
import "./StorePage.css";

const PAGE_SIZE = 12;

export function GamesPage() {
  const { games, status } = useCatalog();
  const ready = status !== "loading";
  const root = useStoreEnter(ready);
  const [params, setParams] = useSearchParams();
  const ceiling = useMemo(() => priceCeiling(games.games), [games.games]);
  const requestedTab = params.get("tab");
  const filters: GameFilterState = {
    collection: isGameTab(requestedTab) ? requestedTab : "todos",
    minPrice: Number(params.get("min") ?? 0) || 0,
    maxPrice: Number(params.get("max") ?? ceiling) || ceiling,
    minMetacritic: Number(params.get("stars") ?? params.get("meta") ?? 0) || 0,
  };
  const filtered = useMemo(
    () => filterGames(games.games, filters, ceiling),
    [games.games, filters, ceiling],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, Number(params.get("page") ?? 1) || 1));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function writeParams(next: GameFilterState, nextPage: number) {
    const nextParams = new URLSearchParams();
    if (next.collection !== "todos") {
      nextParams.set("tab", next.collection);
    }
    if (next.minPrice > 0) {
      nextParams.set("min", String(next.minPrice));
    }
    if (next.maxPrice < ceiling) {
      nextParams.set("max", String(next.maxPrice));
    }
    if (next.minMetacritic > 0) {
      nextParams.set("stars", String(next.minMetacritic));
    }
    if (nextPage > 1) {
      nextParams.set("page", String(nextPage));
    }
    setParams(nextParams, { replace: true });
  }

  function setPage(nextPage: number) {
    writeParams(filters, nextPage);
    document.getElementById("games-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="store" ref={root}>
      <SiteNav />
      <main className="games-page" aria-labelledby="games-page-title">
        {status === "loading" ? (
          <PageLoader label="Cargando juegos…" />
        ) : (
          <>
            <p className="games-crumb">
              <Link to="/">Tienda</Link>
              <span aria-hidden> / </span>
              <span>Nuestros Juegos</span>
            </p>
            <h1 id="games-page-title">Nuestros Juegos</h1>
            <p className="games-tables-lead">
              {filtered.length} títulos · Página {page} de {pageCount}
            </p>

            <div className="games-layout" id="games-catalog">
              <GamesSidebar
                filters={filters}
                ceiling={ceiling}
                onChange={(next) => writeParams(next, 1)}
              />
              <div>
                <GamesTable
                  games={visible}
                  caption={`Catálogo · ${visible.length} en esta página`}
                  layoutKey={`${page}-${filters.collection}-${filters.minPrice}-${filters.maxPrice}-${filters.minMetacritic}`}
                />
                <GamesPager page={page} pageCount={pageCount} onPage={setPage} />
              </div>
            </div>
          </>
        )}
      </main>
      {status !== "loading" ? <Footer9 /> : null}
    </div>
  );
}
