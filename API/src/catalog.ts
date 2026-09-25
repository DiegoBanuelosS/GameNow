import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cacheGet, cacheSet } from "./cache.js";
import {
  deliverImage,
  deliverVideo,
  imageUrl,
  type CloudAsset,
} from "./media.js";
import { config } from "./config.js";
import { formatMxn, toMxn } from "./money.js";
import { loadPressAssets } from "./press.js";
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

function steamAppIdOf(url: string) {
  return url.match(/\/apps\/(\d+)\//)?.[1] || "";
}

function compactTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function sameTitle(productName: string, steamName: string) {
  const product = compactTitle(productName);
  const steam = compactTitle(steamName);
  if (product.length < 3 || steam.length < 3) {
    return false;
  }
  if (product === steam) {
    return true;
  }
  const extra = product.startsWith(steam)
    ? product.slice(steam.length)
    : steam.startsWith(product)
      ? steam.slice(product.length)
      : "";
  return /^(remastered|remaster|ultimateedition|ultimate|definitiveedition|definitive|completeedition|complete|gameoftheyear|goty|deluxeedition|deluxe)/.test(extra);
}

async function matchingSteam(product: ProductDoc) {
  const ids = [...new Set((product.screenshots ?? []).map(steamAppIdOf).filter(Boolean))];
  for (const id of ids) {
    const extras = await loadSteamExtras(id);
    if (extras?.name && sameTitle(product.name, extras.name)) {
      return extras;
    }
  }
  return null;
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

type HostedPress = { cover?: string; trailer?: string; shots?: string[]; videos?: string[] };

const PRESS_VIDEO_HOSTS = new Set([
  "media-rockstargames-com.akamaized.net",
  "www.rockstargames.com",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

function playableUrl(value: string) {
  if (value.startsWith("gamenow/press")) {
    return deliverVideo({ publicId: value, resourceType: "video", hosted: true });
  }
  try {
    const url = new URL(value);
    if (!PRESS_VIDEO_HOSTS.has(url.hostname)) {
      return "";
    }
    return value;
  } catch {
    return "";
  }
}

const hostedPress = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/hosted-press.json"), "utf8"),
) as Record<string, HostedPress>;

function hostedFor(product: ProductDoc) {
  return hostedPress[product.slug] ?? {};
}

async function coverFor(product: ProductDoc, role: "ad" | "event" | "offer" | "hero") {
  const sizes = deliverImage(product.cover, role).sizes;
  const hosted = hostedFor(product).cover;
  if (hosted?.startsWith("gamenow/press")) {
    return { src: imageUrl(hosted, role), srcSet: "", sizes };
  }
  return { src: "", srcSet: "", sizes };
}

async function trailerFor(product: ProductDoc) {
  const hosted = hostedFor(product).trailer;
  return hosted ? playableUrl(hosted) : "";
}

function galleryVideos(product: ProductDoc, poster: string) {
  const hosted = hostedFor(product);
  const listed = hosted.videos?.length ? hosted.videos : hosted.trailer ? [hosted.trailer] : [];
  return listed.flatMap((item, index) => {
    const src = playableUrl(item);
    if (!src) {
      return [];
    }
    return [{
      type: "video" as const,
      src,
      poster,
      alt: `Tráiler ${index + 1} de ${product.name}`,
    }];
  });
}

async function toPublic(product: ProductDoc) {
  const role = roleFor(product);
  const cover = await coverFor(product, role);
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
    studioLogo: "",
    studioLogoSrcSet: "",
    trailer: await trailerFor(product),
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
              details: file?.details ?? row.details,
              sections: file?.sections ?? row.sections,
              trailer: row.trailer ?? file?.trailer,
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
  const cover = await coverFor(match, "hero");
  const base = await toPublic(match);
  const steam = await matchingSteam(match);
  const hostedShots = (hostedFor(match).shots ?? []).map((id) => imageUrl(id, "hero"));
  const screenshotItems = [...hostedShots, ...(hostedShots.length ? [] : steam?.screenshots ?? [])].slice(0, 8).map((url, i) => ({
    type: "image" as const,
    src: url,
    srcSet: undefined,
    sizes: "(min-width: 900px) 56vw, 92vw",
    alt: `${match.name} – captura ${i + 1}`,
  }));
  const pressVideos = galleryVideos(match, cover.src);
  const gallery = [
    {
      type: "image" as const,
      src: cover.src,
      srcSet: cover.srcSet,
      sizes: cover.sizes,
      alt: match.alt,
    },
    ...(pressVideos.length
      ? pressVideos
      : (steam?.videos ?? []).slice(0, 2).map((video, index) => ({
          type: "video" as const,
          src: video.src,
          sources: video.sources,
          poster: video.poster || cover.src,
          alt: `Tráiler ${index + 1} de ${match.name}`,
        }))),
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
