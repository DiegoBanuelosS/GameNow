import { cacheGet, cacheSet } from "./cache.js";

const UA = "GameNow/1.0 (https://gamenow-549.pages.dev)";

export type PressAssets = {
  cover: string;
  trailer: string;
};

function compactTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function sameTitle(productName: string, otherName: string) {
  const product = compactTitle(productName);
  const other = compactTitle(otherName);
  if (product.length < 3 || other.length < 3) {
    return false;
  }
  if (product === other) {
    return true;
  }
  const extra = product.startsWith(other)
    ? product.slice(other.length)
    : other.startsWith(product)
      ? other.slice(product.length)
      : "";
  return /^(remastered|remaster|ultimateedition|ultimate|definitiveedition|definitive|completeedition|complete|gameoftheyear|goty|deluxeedition|deluxe)/.test(extra);
}

function absoluteUrl(base: string, value: string) {
  const raw = value.startsWith("//") ? `https:${value}` : value;
  try {
    return new URL(raw, base).href;
  } catch {
    return "";
  }
}

function fromPage(html: string, pageUrl: string): PressAssets {
  const image =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ||
    "";
  const videos = [...html.matchAll(/(?:https?:)?\/\/[^"'\\\s>]+\.(?:mp4|webm|m3u8)(?:\?[^"'\\\s>]*)?|\/[^"'\\\s>]+\.(?:mp4|webm|m3u8)/gi)]
    .map((match) => absoluteUrl(pageUrl, match[0]))
    .filter((url) => url && !/youtube|youtu\.be|youtube-nocookie/i.test(url));
  const trailer =
    videos.find((url) => /\.mp4/i.test(url) && !/av1/i.test(url)) ||
    videos.find((url) => /\.mp4|\.webm|\.m3u8/i.test(url)) ||
    "";
  return {
    cover: image ? absoluteUrl(pageUrl, image) : "",
    trailer,
  };
}

async function officialSite(name: string) {
  const search = new URL("https://www.wikidata.org/w/api.php");
  search.searchParams.set("action", "wbsearchentities");
  search.searchParams.set("search", name);
  search.searchParams.set("language", "en");
  search.searchParams.set("format", "json");
  search.searchParams.set("type", "item");
  search.searchParams.set("limit", "5");
  const found = await fetch(search, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!found.ok) {
    return "";
  }
  const payload = (await found.json()) as {
    search?: { id?: string; label?: string; description?: string }[];
  };
  const hit = (payload.search ?? []).find(
    (item) => item.id && item.label && sameTitle(name, item.label) && /video game|juego/i.test(item.description || ""),
  );
  if (!hit?.id) {
    return "";
  }
  const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`;
  const entityResponse = await fetch(entityUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!entityResponse.ok) {
    return "";
  }
  const entity = (await entityResponse.json()) as {
    entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: string } } }[]> }>;
  };
  const claims = entity.entities?.[hit.id]?.claims?.P856 ?? [];
  return claims.find((claim) => typeof claim.mainsnak?.datavalue?.value === "string")?.mainsnak?.datavalue?.value || "";
}

async function wikipediaImage(name: string) {
  const search = new URL("https://en.wikipedia.org/w/api.php");
  search.searchParams.set("action", "query");
  search.searchParams.set("list", "search");
  search.searchParams.set("srsearch", `${name} video game`);
  search.searchParams.set("srlimit", "5");
  search.searchParams.set("format", "json");
  const found = await fetch(search, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!found.ok) {
    return "";
  }
  const payload = (await found.json()) as { query?: { search?: { title?: string; snippet?: string }[] } };
  const hit = (payload.query?.search ?? []).find(
    (item) => item.title && sameTitle(name, item.title) && /video game/i.test(item.snippet || ""),
  );
  if (!hit?.title) {
    return "";
  }
  const info = new URL("https://en.wikipedia.org/w/api.php");
  info.searchParams.set("action", "query");
  info.searchParams.set("titles", hit.title);
  info.searchParams.set("prop", "pageimages");
  info.searchParams.set("piprop", "original");
  info.searchParams.set("format", "json");
  const response = await fetch(info, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    return "";
  }
  const body = (await response.json()) as {
    query?: { pages?: Record<string, { original?: { source?: string } }> };
  };
  return Object.values(body.query?.pages ?? {})[0]?.original?.source || "";
}

export async function loadPressAssets(name: string): Promise<PressAssets | null> {
  const key = `press-v3-${compactTitle(name)}`;
  const cached = cacheGet<PressAssets | null>(key);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const [site, image] = await Promise.all([officialSite(name), wikipediaImage(name)]);
    const pages = site ? [site] : [];
    const assets: PressAssets = { cover: image, trailer: "" };
    for (const pageUrl of pages) {
      if (assets.cover && assets.trailer) {
        break;
      }
      try {
        const page = await fetch(pageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
        if (!page.ok) {
          continue;
        }
        const found = fromPage(await page.text(), page.url || pageUrl);
        assets.cover = assets.cover || found.cover;
        assets.trailer = assets.trailer || found.trailer;
      } catch {
        /* siguiente página */
      }
    }
    if (!assets.cover && !assets.trailer) {
      return cacheSet(key, null, 30 * 60 * 1000);
    }
    return cacheSet(key, assets, 6 * 60 * 60 * 1000);
  } catch {
    return cacheSet(key, null, 10 * 60 * 1000);
  }
}
