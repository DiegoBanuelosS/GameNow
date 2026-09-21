import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cacheGet, cacheSet } from "./cache.js";
import {
  deliverImage,
  deliverVideo,
  videoSources,
  type CloudAsset,
} from "./media.js";
import { config } from "./config.js";
import { formatMxn, toMxn } from "./money.js";
import { type RequirementRow } from "./requirements.js";

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
    trailer: deliverVideo(product.trailer),
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
  const cached = cacheGet<ProductDoc[]>("products");
  if (cached) {
    return cached;
  }

  const snapshot = await fromSnapshot();
  const detailsBySlug = new Map(snapshot.map((product) => [product.slug, product.details]));

  if (config.mongoUri) {
    try {
      const { Product } = await import("./models/Product.js");
      const rows = await Product.find().lean();
      if (rows.length) {
        return cacheSet(
          "products",
          (rows as ProductDoc[]).map((row) => ({
            ...row,
            details: row.details ?? detailsBySlug.get(row.slug),
          })),
          30_000,
        );
      }
    } catch {
      /* snapshot fallback */
    }
  }
  return cacheSet("products", snapshot, 30_000);
}

export async function loadProduct(slug: string) {
  const products = await loadProducts();
  const match = products.find((product) => product.slug === slug);
  if (!match) {
    return null;
  }
  const cover = deliverImage(match.cover, "hero");
  const base = await toPublic(match);
  const sources = videoSources(match.trailer);
  const screenshotItems = (match.screenshots ?? []).map((url, i) => ({
    type: "image" as const,
    src: url,
    srcSet: undefined,
    sizes: "(min-width: 900px) 56vw, 92vw",
    alt: `${match.name} – captura ${i + 1}`,
  }));
  const youtubeItems = (match.youtubeTrailers ?? []).map((ytId, i) => ({
    type: "youtube" as const,
    src: `https://www.youtube.com/embed/${ytId}?autoplay=0&rel=0`,
    youtubeId: ytId,
    alt: `Tráiler ${i + 2} de ${match.name}`,
  }));
  const gallery = [
    {
      type: "image" as const,
      src: cover.src,
      srcSet: cover.srcSet,
      sizes: cover.sizes,
      alt: match.alt,
    },
    ...(sources.length
      ? [
          {
            type: "video" as const,
            src: sources[0].src,
            sources,
            poster: cover.src,
            alt: `Tráiler oficial de ${match.name}`,
          },
        ]
      : []),
    ...youtubeItems,
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
