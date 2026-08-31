import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cacheGet, cacheSet } from "./cache.js";
import { loadProducts, type ProductDoc } from "./catalog.js";
import { deliverImage, steamCover } from "./media.js";
import { formatMxn, toMxn } from "./money.js";
import { requirementTable } from "./requirements.js";
import { loadSteamExtras } from "./steam.js";

const FEATURED_SLUGS = ["ace-combat-8", "gta-vi", "ark-2"];

export type CatalogGame = {
  slug: string;
  steamAppId: string;
  name: string;
  alt: string;
  price: number;
  compareAtPrice?: number;
  metacritic: number;
  steamRating: string;
  source: string;
};

async function toPublic(game: CatalogGame) {
  const cover = steamCover(game.steamAppId);
  const onSale = Boolean(game.compareAtPrice && game.compareAtPrice > game.price);
  const table =
    game.metacritic >= 90 ? "rated" : onSale ? "deals" : "catalog";
  const priceValue = await toMxn(game.price, "USD");
  const compare = game.compareAtPrice ? await toMxn(game.compareAtPrice, "USD") : undefined;
  return {
    slug: game.slug,
    steamAppId: game.steamAppId,
    name: game.name,
    alt: game.alt,
    href: `/game/${game.slug}`,
    price: formatMxn(priceValue),
    priceValue,
    was: compare ? formatMxn(compare) : undefined,
    metacritic: game.metacritic || null,
    steamRating: game.steamRating,
    cover: cover.src,
    coverSrcSet: cover.srcSet,
    coverSizes: cover.sizes,
    coverFallback: cover.fallback,
    table,
  };
}

async function fromFeatured(product: ProductDoc) {
  const cover = deliverImage(product.cover, "offer");
  const onSale = Boolean(product.compareAtPrice && product.compareAtPrice > product.price);
  const currency = product.currency || "MXN";
  const priceValue = await toMxn(product.price, currency);
  const compare = product.compareAtPrice
    ? await toMxn(product.compareAtPrice, currency)
    : undefined;
  return {
    slug: product.slug,
    steamAppId: "",
    name: product.name,
    alt: product.alt,
    href: `/game/${product.slug}`,
    price: formatMxn(priceValue),
    priceValue,
    was: compare ? formatMxn(compare) : undefined,
    metacritic: null,
    steamRating: "",
    cover: cover.src,
    coverSrcSet: cover.srcSet,
    coverSizes: "120px",
    coverFallback: product.cover.local,
    table: onSale ? ("deals" as const) : ("catalog" as const),
  };
}

async function fromSnapshot(): Promise<CatalogGame[]> {
  const raw = await readFile(resolve(process.cwd(), "data/games.json"), "utf8");
  return JSON.parse(raw) as CatalogGame[];
}

type GamesCatalog = {
  games: ReturnType<typeof toPublic>[];
  tables: {
    rated: ReturnType<typeof toPublic>[];
    deals: ReturnType<typeof toPublic>[];
    catalog: ReturnType<typeof toPublic>[];
  };
  total: number;
};

export async function loadGames() {
  const cached = cacheGet<GamesCatalog>("games-mxn");
  if (cached) {
    return cached;
  }
  const snapshot = await Promise.all((await fromSnapshot()).map(toPublic));
  const featured = await Promise.all(
    (await loadProducts())
      .filter((product) => FEATURED_SLUGS.includes(product.slug))
      .sort((a, b) => FEATURED_SLUGS.indexOf(a.slug) - FEATURED_SLUGS.indexOf(b.slug))
      .map(fromFeatured),
  );
  const games = [
    ...featured,
    ...snapshot.filter((game) => !FEATURED_SLUGS.includes(game.slug)),
  ];
  return cacheSet(
    "games",
    {
      games,
      tables: {
        rated: games.filter((game) => game.table === "rated"),
        deals: games.filter((game) => game.table === "deals"),
        catalog: games.filter((game) => game.table === "catalog"),
      },
      total: games.length,
    },
    60_000,
  );
}

export async function loadGame(slug: string) {
  const catalog = await loadGames();
  const game = catalog.games.find((row) => row.slug === slug);
  if (!game) {
    return null;
  }
  const extras = game.steamAppId ? await loadSteamExtras(game.steamAppId) : null;
  const gallery = [
    {
      type: "image" as const,
      src: game.cover,
      srcSet: game.coverSrcSet,
      sizes: "min(100vw, 860px)",
      fallback: game.coverFallback,
      alt: game.alt,
    },
    ...(extras?.videos ?? []).map((video, index) => ({
      type: "video" as const,
      src: video.src,
      poster: video.poster,
      alt: `Vídeo ${index + 1} de ${game.name}`,
    })),
    ...(extras?.screenshots ?? []).map((src, index) => ({
      type: "image" as const,
      src,
      alt: `Captura ${index + 1} de ${game.name}`,
    })),
  ];
  return {
    ...game,
    studio: extras?.developers.join(", ") || "",
    studioLogo: "",
    trailer: extras?.videos[0]?.src || "",
    description: extras?.description || "",
    release: extras?.release || "",
    requirements: extras?.requirements || {},
    requirementsTable: requirementTable(
      extras?.requirements?.minimum,
      extras?.requirements?.recommended,
    ),
    gallery,
    sections: { ad: null, event: null, offer: null },
  };
}
