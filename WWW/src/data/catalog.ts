import { useEffect, useState } from "react";

export type StoreProduct = {
  slug: string;
  name: string;
  studio: string;
  alt: string;
  href: string;
  price: string;
  priceValue: number;
  was?: string;
  cover: string;
  coverSrcSet?: string;
  coverSizes?: string;
  studioLogo: string;
  studioLogoSrcSet?: string;
  trailer: string;
  tag?: string;
  description?: string;
  release?: string;
  platforms?: string;
  metacritic?: number | null;
  steamRating?: string;
  gallery?: {
    type: "image" | "video";
    src: string;
    srcSet?: string;
    sizes?: string;
    poster?: string;
    fallback?: string;
    sources?: { src: string; type: string }[];
    alt: string;
  }[];
  requirements?: {
    minimum?: string;
    recommended?: string;
  };
  requirementsTable?: { label: string; min: string; max: string }[];
  requirementsNote?: string;
  sections: {
    ad: number | null;
    event: number | null;
    offer: number | null;
  };
};

export type CatalogGame = {
  slug: string;
  steamAppId: string;
  name: string;
  alt: string;
  href: string;
  price: string;
  priceValue: number;
  was?: string;
  metacritic: number | null;
  steamRating: string;
  cover: string;
  coverSrcSet?: string;
  coverSizes?: string;
  coverFallback?: string;
  table: "rated" | "deals" | "catalog";
};

export type GamesCatalog = {
  games: CatalogGame[];
  tables: {
    rated: CatalogGame[];
    deals: CatalogGame[];
    catalog: CatalogGame[];
  };
  total: number;
};

export type StoreCatalog = {
  ads: StoreProduct[];
  events: StoreProduct[];
  offers: StoreProduct[];
  authPanel: string;
  authPanelSrcSet?: string;
};

const empty: StoreCatalog = {
  ads: [],
  events: [],
  offers: [],
  authPanel: "",
};

export async function fetchStore(): Promise<StoreCatalog> {
  const response = await fetch("/api/store");
  if (!response.ok) {
    throw new Error("No se pudo cargar el catálogo.");
  }
  return (await response.json()) as StoreCatalog;
}

export async function fetchProduct(slug: string): Promise<StoreProduct | null> {
  const response = await fetch(`/api/products/${slug}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("No se pudo cargar el producto.");
  }
  return (await response.json()) as StoreProduct;
}

export async function fetchGames(): Promise<GamesCatalog> {
  const response = await fetch("/api/games");
  if (!response.ok) {
    throw new Error("No se pudo cargar Nuestros Juegos.");
  }
  return (await response.json()) as GamesCatalog;
}

export function useOurCovers() {
  const [covers, setCovers] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchGames().catch(() => null),
      fetchStore().catch(() => null),
    ]).then(([games, store]) => {
      if (!alive) return;
      const next = new Map<string, string>();
      const add = (key: string | undefined, cover: string | undefined) => {
        if (!key || !cover) return;
        next.set(key, cover);
        next.set(key.toLowerCase(), cover);
      };
      for (const game of games?.games ?? []) {
        add(game.steamAppId, game.coverFallback || game.cover);
        add(game.slug, game.coverFallback || game.cover);
        add(game.name, game.coverFallback || game.cover);
      }
      for (const product of [...(store?.ads ?? []), ...(store?.events ?? []), ...(store?.offers ?? [])]) {
        add(product.slug, product.cover);
        add(product.name, product.cover);
      }
      setCovers(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return covers;
}

export type PcFit = {
  verdict: "well" | "poor" | "no" | "unknown";
  title: string;
  detail: string;
  machine: string;
};

export async function fetchPcFit(
  slug: string,
  pc: { os?: string; cpu?: string; gpu?: string; ramGb?: number | null },
): Promise<PcFit> {
  const response = await fetch("/api/pc-fit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, ...pc }),
  });
  if (!response.ok) {
    throw new Error("No se pudo comprobar tu PC.");
  }
  return (await response.json()) as PcFit;
}

export { empty as emptyCatalog };
