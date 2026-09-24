import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cacheGet, cacheSet } from "./cache.js";
import {
  deliverImage,
  type CloudAsset,
} from "./media.js";
import { config } from "./config.js";
import { formatMxn, toMxn } from "./money.js";
import { type RequirementRow } from "./requirements.js";
import { loadSteamExtras } from "./steam.js";

export type ProductDoc = {
  slug: string;
  name: string;
  studio: string;
  alt: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  sections: {
    ad: number | null;
    event: number | null;
    offer: number | null;
  };
  cover: CloudAsset;
  studioLogo?: CloudAsset;
  trailer?: CloudAsset;
  /** Steam screenshot URLs injected by the add_game_details script */
  screenshots?: string[];
  /** Extra YouTube video IDs to append to the gallery */
  youtubeTrailers?: string[];
  /** Metacritic / internal score (0–100) */
  metacritic?: number;
  /** Human-readable Steam rating string, e.g. "Muy positivas" */
  steamRating?: string;
  details?: {
    release?: string;
    platforms?: string;
    description?: string;
    requirementsNote?: string;
    requirements?: RequirementRow[];
  };
};

function steamAppIdOf(product: ProductDoc) {
  for (const url of product.screenshots ?? []) {
    const id = url.match(/\/apps\/(\d+)\//)?.[1];
    if (id) {
      return id;
    }
  }
  return "";
}

async function steamTrailer(product: ProductDoc) {
  const extras = await loadSteamExtras(steamAppIdOf(product));
  return extras?.videos[0]?.src || "";
}

function roleFor(product: ProductDoc) {
  if (product.sections.ad != null) {
    return "ad" as const;
  }
  if (product.sections.event != null) {
    return "event" as const;
  }
  return "offer" as const;
}

async function toPublic(product: ProductDoc) {
  const role = roleFor(product);
  const cover = deliverImage(product.cover, role);
  const logo = deliverImage(product.studioLogo, "logo");
  const currency = product.currency || "MXN";
  const priceValue = await toMxn(product.price, currency);
  const compare = product.compareAtPrice
    ? await toMxn(product.compareAtPrice, currency)
    : undefined;
  return {
    slug: product.slug,
    name: product.name,
    studio: product.studio,
    alt: product.alt,
    href: `/game/${product.slug}`,
    price: formatMxn(priceValue),
    priceValue,
    was: compare ? formatMxn(compare) : undefined,
    cover: cover.src,
    coverSrcSet: cover.srcSet,
    coverSizes: cover.sizes,
    studioLogo: logo.src,
    studioLogoSrcSet: logo.srcSet,
    trailer: await steamTrailer(product),
    tag: product.sections.event != null ? "Evento" : undefined,
    description: product.details?.description || "",
    release: product.details?.release || "",
    platforms: product.details?.platforms || "",
    metacritic: product.metacritic,
    steamRating: product.steamRating,
    sections: product.sections,
  };
}

async function fromSnapshot(): Promise<ProductDoc[]> {
  const file = resolve(process.cwd(), "data/catalog.json");
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as ProductDoc[];
}

export async function loadProducts(): Promise<ProductDoc[]> {
  const cached = cacheGet<ProductDoc[]>("products-steam");
  if (cached) {
    return cached;
  }

  const snapshot = await fromSnapshot();
  const fileBySlug = new Map(snapshot.map((product) => [product.slug, product]));

  if (config.mongoUri) {
    try {
      const { Product } = await import("./models/Product.js");
      const rows = await Product.find().lean();
      if (rows.length) {
        return cacheSet(
          "products-steam",
          (rows as ProductDoc[]).map((row) => {
            const file = fileBySlug.get(row.slug);
            return {
              ...row,
              details: row.details ?? file?.details,
              trailer: undefined,
              screenshots: file?.screenshots?.length ? file.screenshots : row.screenshots,
              youtubeTrailers: [],
            };
          }),
          30_000,
        );
      }
    } catch {
      /* snapshot fallback */
    }
  }
  return cacheSet("products-steam", snapshot, 30_000);
}

export async function loadProduct(slug: string) {
  const products = await loadProducts();
  const match = products.find((product) => product.slug === slug);
  if (!match) {
    return null;
  }
  const cover = deliverImage(match.cover, "hero");
  const base = await toPublic(match);
  const steam = await loadSteamExtras(steamAppIdOf(match));
  const steamShots = (steam?.screenshots ?? []).filter(
    (url) => !(match.screenshots ?? []).includes(url),
  );
  const screenshotItems = [...(match.screenshots ?? []), ...steamShots].slice(0, 8).map((url, i) => ({
    type: "image" as const,
    src: url,
    srcSet: undefined,
    sizes: "(min-width: 900px) 56vw, 92vw",
    alt: `${match.name} – captura ${i + 1}`,
  }));
  const gallery = [
    {
      type: "image" as const,
      src: cover.src,
      srcSet: cover.srcSet,
      sizes: cover.sizes,
      alt: match.alt,
    },
    ...(steam?.videos ?? []).slice(0, 2).map((video, index) => ({
      type: "video" as const,
      src: video.src,
      sources: video.sources,
      poster: video.poster || cover.src,
      alt: `Tráiler ${index + 1} de ${match.name}`,
    })),
    ...screenshotItems,
  ];
  const details = match.details;
  return {
    ...base,
    cover: cover.src,
    coverSrcSet: cover.srcSet,
    coverSizes: cover.sizes,
    description: details?.description || "",
    release: details?.release || "",
    platforms: details?.platforms || "",
    metacritic: match.metacritic,
    steamRating: match.steamRating,
    requirementsNote: details?.requirementsNote || "",
    requirementsTable: details?.requirements || [],
    gallery,
  };
}

export async function loadStore() {
  const cached = cacheGet<
    Awaited<ReturnType<typeof toPublic>> & { authPanel?: string }
  >("store-mxn");
  if (cached) {
    return cached;
  }

  const products = await Promise.all((await loadProducts()).map(toPublic));
  const ads = products
    .filter((product) => product.sections.ad != null)
    .sort((a, b) => (a.sections.ad ?? 0) - (b.sections.ad ?? 0));
  const events = products
    .filter((product) => product.sections.event != null)
    .sort((a, b) => (a.sections.event ?? 0) - (b.sections.event ?? 0));
  const offers = products
    .filter((product) => product.sections.offer != null)
    .sort((a, b) => (a.sections.offer ?? 0) - (b.sections.offer ?? 0));

  let authPanel = "";
  let authPanelSrcSet = "";
  if (config.mongoUri) {
    try {
      const { Setting } = await import("./models/Setting.js");
      const site = await Setting.findOne({ key: "site" }).lean();
      if (site?.authPanel) {
        const image = deliverImage(site.authPanel as CloudAsset, "auth");
        authPanel = image.src;
        authPanelSrcSet = image.srcSet;
      }
    } catch {
      /* ignore */
    }
  }

  if (!authPanel) {
    try {
      const raw = await readFile(resolve(process.cwd(), "data/site.json"), "utf8");
      const site = JSON.parse(raw) as { authPanel?: CloudAsset };
      const image = deliverImage(site.authPanel, "auth");
      authPanel = image.src;
      authPanelSrcSet = image.srcSet;
    } catch {
      /* ignore */
    }
  }

  return cacheSet(
    "store",
    { ads, events, offers, authPanel, authPanelSrcSet },
    30_000,
  );
}
