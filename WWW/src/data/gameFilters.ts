import type { CatalogGame } from "./catalog";

export const GAME_COLLECTIONS = [
  { id: "valorados", label: "Mejor valorados" },
  { id: "ofertas", label: "Ofertas" },
  { id: "catalogo", label: "Catálogo" },
] as const;

export type GameCollectionId = (typeof GAME_COLLECTIONS)[number]["id"];
export type GameTabId = GameCollectionId | "todos";

export type GameFilterState = {
  collection: GameTabId;
  minPrice: number;
  maxPrice: number;
  minMetacritic: number;
};

export const DEFAULT_FILTERS: GameFilterState = {
  collection: "todos",
  minPrice: 0,
  maxPrice: 2000,
  minMetacritic: 0,
};

export function isGameTab(value: string | null): value is GameTabId {
  return value === "todos" || GAME_COLLECTIONS.some((item) => item.id === value);
}

export function priceCeiling(games: CatalogGame[]) {
  const retail = games
    .map((game) => game.priceValue)
    .filter((price) => price > 0 && price <= 2500);
  return Math.max(400, Math.ceil(Math.max(0, ...retail)));
}

export function filterGames(games: CatalogGame[], filters: GameFilterState, ceiling: number) {
  const openMax = filters.maxPrice >= ceiling;
  return games.filter((game) => {
    if (filters.collection === "valorados" && game.table !== "rated") {
      return false;
    }
    if (filters.collection === "ofertas" && game.table !== "deals") {
      return false;
    }
    if (filters.collection === "catalogo" && game.table !== "catalog") {
      return false;
    }
    if (game.priceValue < filters.minPrice) {
      return false;
    }
    if (!openMax && game.priceValue > filters.maxPrice) {
      return false;
    }
    if (filters.minMetacritic > 0) {
      const stars = Math.round(((game.metacritic ?? 0) / 100) * 5);
      if (stars < filters.minMetacritic) {
        return false;
      }
    }
    return true;
  });
}

export function filtersToSearch(filters: GameFilterState, ceiling: number) {
  const params = new URLSearchParams();
  if (filters.collection !== "todos") {
    params.set("tab", filters.collection);
  }
  if (filters.minPrice > 0) {
    params.set("min", String(filters.minPrice));
  }
  if (filters.maxPrice < ceiling) {
    params.set("max", String(filters.maxPrice));
  }
  if (filters.minMetacritic > 0) {
    params.set("stars", String(filters.minMetacritic));
  }
  const query = params.toString();
  return query ? `/juegos?${query}` : "/juegos";
}
