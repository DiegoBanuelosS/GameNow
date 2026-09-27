import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cacheGet, cacheSet } from "./cache.js";
import { config } from "./config.js";
import { steamCover } from "./media.js";
import { formatMxn, usdMxnRate } from "./money.js";
import { requirementTable } from "./requirements.js";
import { loadSteamExtras } from "./steam.js";

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

export function toPublicWithRate(game: CatalogGame, rate: number) {
  const cover = steamCover(game.steamAppId);
  const onSale = Boolean(game.compareAtPrice && game.compareAtPrice > game.price);
  const table =
    game.metacritic >= 90 ? "rated" : onSale ? "deals" : "catalog";
  const priceValue = Math.round(game.price * rate * 100) / 100;
  const compare = game.compareAtPrice ? Math.round(game.compareAtPrice * rate * 100) / 100 : undefined;
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

type SteamPrice = { final: number; initial: number } | "free" | "unavailable";

const PRICE_TTL = 6 * 60 * 60 * 1000;

/** Precios reales de Steam (MXN) para los juegos que el índice agregó sin precio. */
async function steamPrices(appIds: string[]) {
  const prices = new Map<string, SteamPrice>();
  const missing: string[] = [];
  for (const id of new Set(appIds.filter(Boolean))) {
    const hit = cacheGet<SteamPrice>(`steam-price:${id}`);
    if (hit) prices.set(id, hit);
    else missing.push(id);
  }
  for (let start = 0; start < missing.length; start += 25) {
    const batch = missing.slice(start, start + 25);
    try {
      const url = new URL("https://store.steampowered.com/api/appdetails");
      url.searchParams.set("appids", batch.join(","));
      url.searchParams.set("cc", "mx");
      url.searchParams.set("filters", "price_overview");
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) continue;
      const payload = (await response.json()) as Record<
        string,
        { success?: boolean; data?: { price_overview?: { final: number; initial: number } } | unknown[] }
      >;
      for (const id of batch) {
        const entry = payload[id];
        if (!entry) continue;
        const overview = entry.data && !Array.isArray(entry.data) ? entry.data.price_overview : undefined;
        const price: SteamPrice = !entry.success
          ? "unavailable"
          : overview
            ? { final: overview.final / 100, initial: overview.initial / 100 }
            : "free";
        prices.set(id, cacheSet(`steam-price:${id}`, price, PRICE_TTL));
      }
    } catch {
      // Sin respuesta de Steam: esos juegos se muestran sin precio hasta el siguiente intento.
    }
  }
  return prices;
}

async function withPrices(games: CatalogGame[], rate: number) {
  const prices = await steamPrices(games.filter((game) => !(game.price > 0)).map((game) => game.steamAppId));
  return games.map((game) => {
    const row = toPublicWithRate(game, rate);
    if (game.price > 0) return row;
    const steam = prices.get(game.steamAppId);
    if (steam && typeof steam === "object") {
      const onSale = steam.initial > steam.final;
      return {
        ...row,
        price: formatMxn(steam.final),
        priceValue: steam.final,
        was: onSale ? formatMxn(steam.initial) : undefined,
        table: row.table === "rated" ? row.table : onSale ? "deals" : row.table,
      };
    }
    return {
      ...row,
      price: steam === "free" ? "Gratis" : "No disponible",
      priceValue: 0,
      was: undefined,
    };
  });
}

async function toPublic(game: CatalogGame) {
  const rate = await usdMxnRate();
  return toPublicWithRate(game, rate);
}

async function fromSnapshot(): Promise<CatalogGame[]> {
  if (config.mongoUri) {
    try {
      const { connectDb } = await import("./db.js");
      if (await connectDb()) {
        const { Game } = await import("./models/Game.js");
        const rows = await Game.find().select("-__v -createdAt -updatedAt").lean();
        if (rows.length) {
          return rows as CatalogGame[];
        }
      }
    } catch {
      // Si Atlas no responde, se usa el JSON local
    }
  }
  const raw = await readFile(resolve(process.cwd(), "data/games.json"), "utf8");
  return JSON.parse(raw) as CatalogGame[];
}

type PublicGame = Awaited<ReturnType<typeof toPublic>>;

type GamesCatalog = {
  games: PublicGame[];
  tables: {
    rated: PublicGame[];
    deals: PublicGame[];
    catalog: PublicGame[];
  };
  total: number;
};

const PAGE_SIZE = 10;

function slugify(title: string, appId: string) {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `steam-${appId}`;
}

async function steamAppList() {
  const cached = cacheGet<{ appid: number; name: string }[]>("steam-app-list");
  if (cached) return cached;
  if (!config.steamApiKey) throw new Error("Sin clave de catálogo.");
  const apps: { appid: number; name: string }[] = [];
  let lastAppId = 0;
  for (let page = 0; page < 40 && apps.length < 1_000_000; page += 1) {
    const url = new URL("https://api.steampowered.com/IStoreService/GetAppList/v1/");
    url.searchParams.set("key", config.steamApiKey);
    url.searchParams.set("include_games", "true");
    url.searchParams.set("max_results", "50000");
    if (lastAppId) url.searchParams.set("last_appid", String(lastAppId));
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(String(response.status));
    const payload = (await response.json()) as {
      response?: { apps?: { appid: number; name: string }[]; have_more_results?: boolean; last_appid?: number };
    };
    const batch = payload.response?.apps ?? [];
    for (const app of batch) {
      if (app.appid && app.name?.trim()) apps.push({ appid: app.appid, name: app.name });
    }
    if (!payload.response?.have_more_results || !batch.length) break;
    lastAppId = payload.response.last_appid || batch[batch.length - 1].appid;
  }
  return cacheSet("steam-app-list", apps, 6 * 60 * 60 * 1000);
}

async function catalogIndex() {
  const cached = cacheGet<CatalogGame[]>("catalog-index");
  if (cached) return cached;
  const known = await fromSnapshot();
  const ids = new Set(known.map((game) => game.steamAppId));
  const slugs = new Set(known.map((game) => game.slug));
  let extra: CatalogGame[] = [];
  try {
    const apps = await steamAppList();
    extra = [];
    for (const app of apps) {
      const steamAppId = String(app.appid);
      if (ids.has(steamAppId)) continue;
      const name = app.name.trim();
      if (name.length < 2) continue;
      let slug = slugify(name, steamAppId);
      if (slugs.has(slug)) slug = `${slug}-${steamAppId}`;
      slugs.add(slug);
      ids.add(steamAppId);
      extra.push({
        slug,
        steamAppId,
        name,
        alt: name,
        price: 0,
        metacritic: 0,
        steamRating: "",
        source: "steam",
      });
    }
  } catch (error) {
    console.error("No se pudo ampliar el catálogo.", error);
  }
  return cacheSet("catalog-index", [...known, ...extra], extra.length ? 6 * 60 * 60 * 1000 : 5 * 60 * 1000);
}

function matchesQuery(
  game: CatalogGame,
  rate: number,
  query: { tab?: string; min?: number; max?: number; stars?: number; q?: string; ceiling: number },
) {
  const priceValue = Math.round(game.price * rate * 100) / 100;
  const onSale = Boolean(game.compareAtPrice && game.compareAtPrice > game.price);
  const table = game.metacritic >= 90 ? "rated" : onSale ? "deals" : "catalog";
  if (query.tab === "valorados" && table !== "rated") return false;
  if (query.tab === "ofertas" && table !== "deals") return false;
  if (query.tab === "catalogo" && table !== "catalog") return false;
  if (priceValue < (query.min ?? 0)) return false;
  if (query.max != null && query.max < query.ceiling && priceValue > query.max) return false;
  if ((query.stars ?? 0) > 0) {
    const stars = Math.round((game.metacritic / 100) * 5);
    if (stars < (query.stars ?? 0)) return false;
  }
  if (query.q && !game.name.toLowerCase().includes(query.q)) return false;
  return true;
}

export async function loadGamesPage(input: { page?: number; tab?: string; min?: number; max?: number; stars?: number; q?: string }) {
  const rate = await usdMxnRate();
  const index = await catalogIndex();
  const retail = index.map((game) => Math.round(game.price * rate * 100) / 100).filter((price) => price > 0 && price <= 2500);
  const ceiling = Math.max(400, Math.ceil(Math.max(0, ...retail)));
  const matched = index.filter((game) => matchesQuery(game, rate, { ...input, ceiling }));
  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, input.page || 1));
  const games = await withPrices(matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), rate);
  return { games, total: matched.length, page, pageCount, ceiling };
}

export async function findCatalogGame(slug: string) {
  const index = await catalogIndex();
  return index.find((game) => game.slug === slug) ?? null;
}

/** Juego del índice completo con su precio real (para comprar juegos fuera del catálogo curado). */
export async function loadPricedGame(slug: string) {
  const raw = await findCatalogGame(slug);
  if (!raw) return null;
  const [game] = await withPrices([raw], await usdMxnRate());
  return game;
}

export async function loadGames() {
  const cached = cacheGet<GamesCatalog>("games-mxn");
  if (cached) {
    return cached;
  }
  const rate = await usdMxnRate();
  const rawSnapshot = await fromSnapshot();
  const games = rawSnapshot.map((game) => toPublicWithRate(game, rate));
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
  const game = await loadPricedGame(slug);
  if (!game) {
    return null;
  }
  const extras = game.steamAppId ? await loadSteamExtras(game.steamAppId) : null;
  const gallery = [
    ...(extras?.videos ?? []).map((video, index) => ({
      type: "video" as const,
      src: video.src,
      sources: video.sources,
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
