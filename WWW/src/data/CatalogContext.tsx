import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  emptyCatalog,
  fetchGames,
  fetchStore,
  type GamesCatalog,
  type StoreCatalog,
} from "./catalog";
import { warmupVideos } from "./videoCache";

const emptyGames: GamesCatalog = {
  games: [],
  tables: { rated: [], deals: [], catalog: [] },
  total: 0,
};

type CatalogState = {
  catalog: StoreCatalog;
  games: GamesCatalog;
  status: "loading" | "ready" | "error";
};

const CatalogContext = createContext<CatalogState>({
  catalog: emptyCatalog,
  games: emptyGames,
  status: "loading",
});

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CatalogState>({
    catalog: emptyCatalog,
    games: emptyGames,
    status: "loading",
  });

  useEffect(() => {
    let alive = true;
    Promise.all([fetchStore(), fetchGames()])
      .then(([catalog, games]) => {
        if (alive) {
          setState({ catalog, games, status: "ready" });
          warmupVideos(catalog.ads.map((ad) => ad.trailer).filter(Boolean));
        }
      })
      .catch(() => {
        if (alive) {
          setState({ catalog: emptyCatalog, games: emptyGames, status: "error" });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  return useContext(CatalogContext);
}
