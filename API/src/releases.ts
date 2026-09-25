import { cacheGet, cacheSet } from "./cache.js";
import { loadStore } from "./catalog.js";
import { requirementTable, type RequirementRow } from "./requirements.js";

const UA = "GameNow/1.0 (https://github.com/GameNow; store calendar)";
const WINDOW_DAYS = 21;
const PER_DAY = 3;

const STEAM_MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export type ReleaseAsset = {
  type: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
};

export type ReleaseTitle = {
  appId: string;
  name: string;
  studio: string;
  cover: string;
  price: string;
  href: string;
  description: string;
  genres: string[];
  assets: ReleaseAsset[];
  specs: RequirementRow[];
};

export type ReleaseDay = {
  date: string;
  label: string;
  shortDate: string;
  releases: ReleaseTitle[];
};

function htmlText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|strong)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function parseSteamDate(text: string) {
  const clean = text.trim().replace(/\./g, "").replace(/,/g, "");
  const dayFirst = clean.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  const monthFirst = clean.match(/^([A-Za-z]{3,})\s+(\d{1,2})\s+(\d{4})$/);
  const match = dayFirst
    ? { day: dayFirst[1], month: dayFirst[2], year: dayFirst[3] }
    : monthFirst
      ? { day: monthFirst[2], month: monthFirst[1], year: monthFirst[3] }
      : null;
  if (!match) return null;
  const month = STEAM_MONTHS[match.month.slice(0, 3).toLowerCase()];
  if (month == null) return null;
  return `${match.year}-${String(month + 1).padStart(2, "0")}-${String(Number(match.day)).padStart(2, "0")}`;
}

function dayMeta(iso: string, today: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "long", timeZone: "UTC" }).format(date);
  const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  const label = iso === today ? "Hoy" : iso === addDays(today, 1) ? "Mañana" : weekday;
  return {
    label: label.charAt(0).toUpperCase() + label.slice(1),
    shortDate: shortDate.replace(".", ""),
  };
}

function decode(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function searchPage(start: number) {
  const url = new URL("https://store.steampowered.com/search/results/");
  url.searchParams.set("query", "");
  url.searchParams.set("start", String(start));
  url.searchParams.set("count", "50");
  url.searchParams.set("filter", "popularcomingsoon");
  url.searchParams.set("infinite", "1");
  url.searchParams.set("ndl", "1");
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(String(response.status));
  const payload = (await response.json()) as { results_html?: string };
  return payload.results_html ?? "";
}

function parseSearch(html: string) {
  return html
    .split('class="search_result_row')
    .slice(1)
    .map((block, index) => ({
      rank: index,
      appId: block.match(/data-ds-appid="(\d+)"/)?.[1] ?? "",
      name: decode(block.match(/<span class="title">([^<]+)<\/span>/)?.[1] ?? ""),
      date: parseSteamDate(block.match(/search_released[^>]*>\s*([^<]+)/)?.[1] ?? ""),
      cover: (block.match(/<img src="([^"]+)"/)?.[1] ?? "").replace(/&amp;/g, "&"),
      tags: (block.match(/data-ds-tagids="\[([^\]]*)\]"/)?.[1] ?? "")
        .split(",")
        .map((id) => Number(id))
        .filter((id) => id > 0),
    }));
}

type SteamApp = {
  name?: string;
  short_description?: string;
  is_free?: boolean;
  developers?: string[];
  header_image?: string;
  release_date?: { date?: string };
  pc_requirements?: { minimum?: string; recommended?: string };
  price_overview?: { final_formatted?: string };
  genres?: { description?: string }[];
  content_descriptors?: { ids?: number[] };
  screenshots?: { path_full?: string }[];
  movies?: {
    id?: number;
    mp4?: { max?: string; "480"?: string };
    webm?: { max?: string; "480"?: string };
    hls_h264?: string;
    thumbnail?: string;
  }[];
};

async function loadDetails(appIds: string[]) {
  const details = new Map<string, SteamApp>();
  let cursor = 0;
  async function worker() {
    while (cursor < appIds.length) {
      const id = appIds[cursor];
      cursor += 1;
      const url = new URL("https://store.steampowered.com/api/appdetails");
      url.searchParams.set("appids", id);
      url.searchParams.set("cc", "mx");
      url.searchParams.set("l", "spanish");
      try {
        const response = await fetch(url, { headers: { "User-Agent": UA } });
        if (!response.ok) continue;
        const payload = (await response.json()) as Record<string, { success?: boolean; data?: SteamApp & { steam_appid?: number } }> | null;
        if (!payload) continue;
        for (const [key, entry] of Object.entries(payload)) {
          if (!entry?.success || !entry.data) continue;
          details.set(id, entry.data);
          details.set(String(entry.data.steam_appid || key), entry.data);
        }
      } catch {
        /* Steam a veces corta la ficha; el calendario sigue sin specs. */
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  return details;
}

function https(url: string) {
  return url.replace(/^http:/, "https:");
}

function assetsFor(app: SteamApp | undefined, cover: string, name: string): ReleaseAsset[] {
  const images: ReleaseAsset[] = [];
  if (cover) images.push({ type: "image", src: https(cover), alt: name });
  for (const shot of app?.screenshots ?? []) {
    if (!shot.path_full || images.length >= 8) break;
    images.push({ type: "image", src: https(shot.path_full), alt: name });
  }
  const videos: ReleaseAsset[] = [];
  for (const movie of app?.movies ?? []) {
    const src =
      movie.mp4?.["480"] ||
      movie.mp4?.max ||
      movie.webm?.["480"] ||
      movie.webm?.max ||
      movie.hls_h264 ||
      "";
    if (!src || videos.length >= 2) continue;
    videos.push({
      type: "video",
      src: https(src),
      poster: movie.thumbnail ? https(movie.thumbnail) : cover,
      alt: name,
    });
  }
  return [...videos, ...images];
}

const ADULT_TAGS = new Set([6650, 9130, 9551, 12095, 24904]);
const ADULT_DESCRIPTOR = new Set([1, 3, 4]);
const ADULT_GENRE = /desnudos|contenido sexual|solo adultos|nudity|sexual content|adult only|hentai|er[oó]tic/i;
const ADULT_TEXT = /\b(porn|porno|hentai|nsfw|eroge|xxx)\b/i;

function isAdult(app: SteamApp | undefined, name: string) {
  if (ADULT_TEXT.test(name)) return true;
  if (!app) return false;
  if ((app.content_descriptors?.ids ?? []).some((id) => ADULT_DESCRIPTOR.has(id))) return true;
  const genres = (app.genres ?? []).map((genre) => genre.description || "").join(" ");
  if (ADULT_GENRE.test(genres)) return true;
  return ADULT_TEXT.test(app.short_description || "");
}

function priceLabel(app: SteamApp | undefined) {
  if (!app) return "";
  if (app.is_free) return "Gratis";
  return app.price_overview?.final_formatted || "";
}

export async function loadReleases(): Promise<{ days: ReleaseDay[] }> {
  const today = todayIso();
  const cached = cacheGet<{ days: ReleaseDay[] }>(`releases-v13-${today}`);
  if (cached) return cached;

  const html = (await Promise.all([searchPage(0), searchPage(50)])).join("\n");
  const until = addDays(today, WINDOW_DAYS);
  const seen = new Set<string>();
  const picked = parseSearch(html)
    .filter((item) => {
      if (!item.appId || /demo|soundtrack|ost\b/i.test(item.name)) return false;
      if (item.tags.some((id) => ADULT_TAGS.has(id)) || ADULT_TEXT.test(item.name)) return false;
      if (seen.has(item.appId)) return false;
      seen.add(item.appId);
      return true;
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 40);

  const [details, store] = await Promise.all([
    loadDetails(picked.map((item) => item.appId)),
    loadStore().catch(() => null),
  ]);
  const catalog = store ? [...store.ads, ...store.events, ...store.offers] : [];

  const byDate = new Map<string, ReleaseTitle[]>();
  for (const item of picked) {
    const app = details.get(item.appId);
    const name = app?.name || item.name;
    if (isAdult(app, name)) continue;
    const date = parseSteamDate(app?.release_date?.date || "");
    if (!date || date < today || date > until) continue;
    if ((byDate.get(date)?.length ?? 0) >= PER_DAY) continue;
    const match = catalog.find((game) => game.name.toLowerCase() === name.toLowerCase());
    const title: ReleaseTitle = {
      appId: item.appId,
      name,
      studio: app?.developers?.[0] || "",
      cover: app?.header_image || item.cover,
      price: priceLabel(app),
      href: match?.href || "",
      description: htmlText(app?.short_description || ""),
      genres: (app?.genres ?? []).map((genre) => genre.description || "").filter(Boolean),
      assets: assetsFor(app, app?.header_image || item.cover, name),
      specs: requirementTable(htmlText(app?.pc_requirements?.minimum || ""), htmlText(app?.pc_requirements?.recommended || "")),
    };
    const list = byDate.get(date) ?? [];
    list.push(title);
    byDate.set(date, list);
  }

  const last = [...byDate.keys()].sort().at(-1) ?? addDays(today, 6);
  const end = last < addDays(today, 6) ? addDays(today, 6) : last;
  const days: ReleaseDay[] = [];
  for (let iso = today; iso <= end; iso = addDays(iso, 1)) {
    const meta = dayMeta(iso, today);
    days.push({ date: iso, ...meta, releases: byDate.get(iso) ?? [] });
  }

  return cacheSet(`releases-v13-${today}`, { days }, 1000 * 60 * 60);
}

export async function loadAppTitle(appId: string): Promise<ReleaseTitle | null> {
  if (!/^\d+$/.test(appId)) return null;
  const cached = cacheGet<ReleaseTitle>(`title-v1-${appId}`);
  if (cached) return cached;
  const details = await loadDetails([appId]);
  const app = details.get(appId);
  const name = app?.name || "";
  if (!name || isAdult(app, name)) return null;
  const store = await loadStore().catch(() => null);
  const match = store
    ? [...store.ads, ...store.events, ...store.offers].find((game) => game.name.toLowerCase() === name.toLowerCase())
    : undefined;
  const title: ReleaseTitle = {
    appId,
    name,
    studio: app?.developers?.[0] || "",
    cover: app?.header_image || "",
    price: priceLabel(app),
    href: match?.href || "",
    description: htmlText(app?.short_description || ""),
    genres: (app?.genres ?? []).map((genre) => genre.description || "").filter(Boolean),
    assets: assetsFor(app, app?.header_image || "", name),
    specs: requirementTable(htmlText(app?.pc_requirements?.minimum || ""), htmlText(app?.pc_requirements?.recommended || "")),
  };
  return cacheSet(`title-v1-${appId}`, title, 1000 * 60 * 60);
}
