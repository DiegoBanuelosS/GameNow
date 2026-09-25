import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiUrl } from "../../data/api";
import type { CatalogGame } from "../../data/catalog";
import { useCatalog } from "../../data/CatalogContext";
import { isGameTab, type GameFilterState } from "../../data/gameFilters";
import { Footer9 } from "./Footer9";
import { GamesPager } from "./GamesPager";
import { GamesSidebar } from "./GamesSidebar";
import { GamesTable } from "./GamesTable";
import { PageLoader } from "./LogoLoader";
import { SiteNav } from "./SiteNav";
import { useStoreEnter } from "./useStoreMotion";
import "./GameTables.css";
import "./StorePage.css";

const PAGE_SIZE = 10;

export function GamesPage() {
  const { status } = useCatalog();
  const ready = status !== "loading";
  const root = useStoreEnter(ready);
  const [params, setParams] = useSearchParams();
  const [ceiling, setCeiling] = useState(2000);
  const [visible, setVisible] = useState<CatalogGame[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const requestedTab = params.get("tab");
  const filters: GameFilterState = {
    collection: isGameTab(requestedTab) ? requestedTab : "todos",
    minPrice: Number(params.get("min") ?? 0) || 0,
    maxPrice: Number(params.get("max") ?? ceiling) || ceiling,
    minMetacritic: Number(params.get("stars") ?? params.get("meta") ?? 0) || 0,
  };
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  useEffect(() => {
    const query = new URLSearchParams();
    query.set("page", String(page));
    if (filters.collection !== "todos") query.set("tab", filters.collection);
    if (filters.minPrice > 0) query.set("min", String(filters.minPrice));
    if (filters.maxPrice < ceiling) query.set("max", String(filters.maxPrice));
    if (filters.minMetacritic > 0) query.set("stars", String(filters.minMetacritic));
    let alive = true;
    fetch(apiUrl(`/api/games?${query}`))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ games: CatalogGame[]; total: number; pageCount: number; ceiling: number }>;
      })
      .then((payload) => {
        if (!alive) return;
        setVisible(payload.games.slice(0, PAGE_SIZE));
        setTotal(payload.total);
        setPageCount(payload.pageCount);
        if (payload.ceiling) setCeiling(payload.ceiling);
      })
      .catch(() => {
        if (!alive) return;
        setVisible([]);
        setTotal(0);
      });
    return () => {
      alive = false;
    };
  }, [page, filters.collection, filters.minPrice, filters.maxPrice, filters.minMetacritic, ceiling]);

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
              {total} títulos · Página {page} de {pageCount}
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
