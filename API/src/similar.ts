import { cacheGet, cacheSet } from "./cache.js";
import { loadGames } from "./games.js";
import { steamCover } from "./media.js";

export type SimilarGame = {
  appId: string;
  name: string;
  cover: string;
  price: string;
  href: string;
};

const ADULT_TAGS = new Set([6650, 9130, 9551, 12095, 24904]);
const SKIP = /demo|soundtrack|\bost\b|wallpaper engine|dedicated server|\bsdk\b|server$/i;

function clean(value: string) {
  return value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function nameFromHref(href: string) {
  const slug = decodeURIComponent(href.match(/\/app\/\d+\/([^/?]+)/)?.[1] ?? "");
  return slug.replace(/_/g, " ").trim();
}

function coverFor(appId: string, fallback = "") {
  return fallback || steamCover(appId).fallback || steamCover(appId).src;
}

async function fromMoreLike(appId: string): Promise<SimilarGame[]> {
  const url = new URL(`https://store.steampowered.com/recommended/morelike/app/${appId}`);
  url.searchParams.set("cc", "mx");
  url.searchParams.set("l", "english");
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "birthtime=0; lastagecheckage=1-January-1990; wants_mature_content=1; timezoneOffset=-21600,0",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return [];
  const html = await response.text();
  if (/access denied/i.test(html) || !html.includes("similar_grid")) return [];

  const found: SimilarGame[] = [];
  for (const block of html.split('class="similar_grid_item').slice(1)) {
    const id = block.match(/data-ds-appid="(\d+)"/)?.[1] ?? "";
    if (!id || id === appId || id === "431960") continue;
    const tags = (block.match(/data-ds-tagids="\[([^\]]*)\]"/)?.[1] ?? "")
      .split(",")
      .map(Number)
      .filter((tag) => tag > 0);
    if (tags.some((tag) => ADULT_TAGS.has(tag))) continue;
    const link = block.match(/class="similar_grid_capsule"[\s\S]*?href="([^"]+)"/)?.[1] ?? "";
    const name = nameFromHref(link);
    if (!name || SKIP.test(name)) continue;
    const cover = (block.match(/<img src="([^"]+)"/)?.[1] ?? "").replace(/&amp;/g, "&");
    const price = clean(
      block.match(/discount_final_price">([^<]+)/)?.[1] ||
        block.match(/class="regular_price price">\s*([^<]+)/)?.[1] ||
        "",
    );
    found.push({ appId: id, name, cover: coverFor(id, cover), price, href: "" });
    if (found.length >= 12) break;
  }
  return found;
}

async function steamSpy(appId: string) {
  const response = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appId}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return (await response.json()) as {
    name?: string;
    developer?: string;
    genre?: string;
    tags?: Record<string, number>;
  };
}

async function steamSpyTag(tag: string) {
  const response = await fetch(`https://steamspy.com/api.php?request=tag&tag=${encodeURIComponent(tag)}`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return {};
  return (await response.json()) as Record<string, { name?: string; score_rank?: string; positive?: number; negative?: number }>;
}

async function fromTags(appId: string, genreHint = ""): Promise<SimilarGame[]> {
  const source = await steamSpy(appId);
  if (!source?.tags) return [];
  const topTags = Object.entries(source.tags)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .filter((tag) => !/multiplayer|singleplayer|steam|controller|co-op|online/i.test(tag))
    .slice(0, 4);
  if (!topTags.length && genreHint) topTags.push(genreHint);

  const scores = new Map<string, { name: string; score: number }>();
  for (const [index, tag] of topTags.entries()) {
    const weight = 4 - index;
    const pool = await steamSpyTag(tag);
    for (const [id, row] of Object.entries(pool)) {
      if (id === appId || !row.name || SKIP.test(row.name)) continue;
      const votes = (row.positive || 0) + (row.negative || 0);
      const ratio = votes ? (row.positive || 0) / votes : 0;
      const current = scores.get(id) || { name: row.name, score: 0 };
      current.score += weight * 10 + ratio * 5;
      if (source.developer && row.name.toLowerCase().includes(source.developer.toLowerCase().slice(0, 6))) {
        current.score += 8;
      }
      // Franchise boost: shared leading words with source title
      const sourceWords = (source.name || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      const nameWords = row.name.toLowerCase();
      if (sourceWords.some((word) => nameWords.includes(word))) current.score += 25;
      scores.set(id, current);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 12)
    .map(([id, row]) => ({
      appId: id,
      name: row.name,
      cover: coverFor(id),
      price: "",
      href: "",
    }));
}

export async function loadSimilar(appId: string, genreHint = ""): Promise<SimilarGame[]> {
  if (!/^\d+$/.test(appId)) return [];
  const cacheKey = `similar-v3-${appId}`;
  const cached = cacheGet<SimilarGame[]>(cacheKey);
  if (cached) return cached;

  let found = await fromMoreLike(appId).catch(() => [] as SimilarGame[]);
  if (found.length < 4) {
    const tagged = await fromTags(appId, genreHint).catch(() => [] as SimilarGame[]);
    const seen = new Set(found.map((game) => game.appId));
    for (const game of tagged) {
      if (seen.has(game.appId)) continue;
      found.push(game);
      if (found.length >= 12) break;
    }
  }

  const catalog = await loadGames().catch(() => null);
  const byId = new Map((catalog?.games ?? []).map((game) => [game.steamAppId, game]));
  for (const game of found) {
    const known = byId.get(game.appId);
    if (known) {
      game.href = known.href || `/game/${known.slug}`;
      if (!game.price) game.price = known.price || "";
      if (!game.cover) game.cover = known.coverFallback || known.cover;
    } else if (!game.href) {
      game.href = "";
    }
  }

  return cacheSet(cacheKey, found.slice(0, 12), 1000 * 60 * 60);
}
