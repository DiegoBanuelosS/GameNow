import { config } from "./config.js";

export type SteamGenre = "RPG" | "Acción" | "Aventura" | "Shooter" | "Estrategia" | "Indie";

export interface SteamLibraryGame {
  slug: string;
  steamAppId: string;
  name: string;
  cover: string;
  coverSrcSet: string;
  coverFallback: string;
  banner: string;
  miniIcon: string;
  genre: SteamGenre;
  lastPlayed: string;
  lastPlayedTimestamp: number;
  playTimeHours: number;
  isInstalled: boolean;
  isFavorite: boolean;
  userRating?: number;
  userNote?: string;
  purchased?: boolean;
  paidPrice?: number;
  saleStatus?: "" | "pending";
  salePayout?: number;
  desktopShortcut?: boolean;
  taskbarPin?: boolean;
  beta?: string;
}

export interface SteamAccount {
  steamId: string;
  steamName: string;
  steamAvatarUrl: string;
  steamFrameUrl: string;
  steamBackgroundUrl: string;
  steamBackgroundVideo: string;
  steamGameCount: number;
  steamGames: SteamLibraryGame[];
}

const STEAM_HOSTS =
  /(^|\.)steamstatic\.com$|(^|\.)steamusercontent\.com$|(^|\.)akamaihd\.net$|(^|\.)steamcommunity\.com$|(^|\.)fastly\.steamstatic\.com$/;

function safeAsset(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !STEAM_HOSTS.test(url.hostname)) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferGenre(name: string): SteamGenre {
  const n = name.toLowerCase();
  if (/rpg|baldur|witcher|cyberpunk|elden|souls|fallout|final fantasy/.test(n)) return "RPG";
  if (/strike|shooter|doom|halo|duty|apex|left 4 dead|team fortress/.test(n)) return "Shooter";
  if (/civilization|strategy|total war|dota|stellaris|tactics/.test(n)) return "Estrategia";
  if (/hollow|celeste|hades|stardew|indie|dead cells|undertale/.test(n)) return "Indie";
  if (/gta|auto|assassin|red dead|ark|war|batman/.test(n)) return "Acción";
  return "Aventura";
}

export { inferGenre };

function gameArt(appId: string) {
  const hd = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
  const std = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
  const cyberpunkBanner =
    "https://res.cloudinary.com/fj6z6mba/image/upload/f_auto,q_auto:best,dpr_auto,c_limit,g_center,w_1440/gamenow/presskit/cp-home";
  const phantomCover =
    "https://res.cloudinary.com/fj6z6mba/image/upload/f_auto,q_auto:best,dpr_auto,c_limit,g_center,w_1440/gamenow/presskit/cp-liberty";
  if (appId === "1091500") {
    return {
      cover: hd,
      coverSrcSet: `${std} 600w, ${hd} 1200w`,
      coverFallback: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
      banner: cyberpunkBanner,
      miniIcon: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_sm_120.jpg`,
    };
  }
  if (appId === "2138330") {
    return {
      cover: phantomCover,
      coverSrcSet: "",
      coverFallback: phantomCover,
      banner: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
      miniIcon: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_sm_120.jpg`,
    };
  }
  return {
    cover: hd,
    coverSrcSet: `${std} 600w, ${hd} 1200w`,
    coverFallback: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    banner: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
    miniIcon: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_sm_120.jpg`,
  };
}

function formatPlayed(timestamp: number) {
  if (!timestamp) return "Sin fecha";
  return new Date(timestamp).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function parsePlayedDate(label: string) {
  const cleaned = label.replace(/\./g, "").trim();
  if (!cleaned) return 0;
  const withYear = /\d{4}/.test(cleaned) ? cleaned : `${cleaned} ${new Date().getFullYear()}`;
  const parsed = Date.parse(withYear);
  if (Number.isNaN(parsed)) return 0;
  if (parsed > Date.now() + 86_400_000) {
    const previous = Date.parse(`${cleaned} ${new Date().getFullYear() - 1}`);
    return Number.isNaN(previous) ? 0 : previous;
  }
  return parsed;
}

function toGame(appId: string, name: string, hours: number, timestamp: number): SteamLibraryGame {
  return {
    slug: slugify(name) || `steam-${appId}`,
    steamAppId: appId,
    name,
    ...gameArt(appId),
    genre: inferGenre(name),
    lastPlayed: formatPlayed(timestamp),
    lastPlayedTimestamp: timestamp,
    playTimeHours: Math.round(hours * 10) / 10,
    isInstalled: false,
    isFavorite: false,
  };
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`Steam respondió ${response.status}`);
  }
  return response.text();
}

function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return decodeHtml(match?.[1] || "");
}

function parseFrame(html: string) {
  const block = html.match(/class="profile_avatar_frame"[\s\S]*?<img src="([^"]+)"/i);
  return safeAsset(block?.[1] || "");
}

function parseBackground(html: string) {
  const animated = html.match(
    /class="[^"]*profile_animated_background[^"]*"[\s\S]*?<video\b([^>]*)>([\s\S]*?)<\/video>/i,
  );
  if (animated) {
    const poster = animated[1].match(/poster="([^"]+)"/i)?.[1] || "";
    const webm = animated[2].match(/src="([^"]+\.webm[^"]*)"/i)?.[1] || "";
    const mp4 = animated[2].match(/src="([^"]+\.mp4[^"]*)"/i)?.[1] || "";
    return {
      image: safeAsset(absoluteSteamUrl(poster)),
      video: safeAsset(absoluteSteamUrl(mp4 || webm)),
    };
  }
  const video = html.match(/<video\b[^>]*poster="([^"]+)"[^>]*>([\s\S]*?)<\/video>/i);
  if (video) {
    const webm = video[2].match(/src="([^"]+\.webm[^"]*)"/i)?.[1] || "";
    const mp4 = video[2].match(/src="([^"]+\.mp4[^"]*)"/i)?.[1] || "";
    return {
      image: safeAsset(absoluteSteamUrl(video[1])),
      video: safeAsset(absoluteSteamUrl(mp4 || webm)),
    };
  }
  const image =
    html.match(/class="[^"]*profile_background[^"]*"[^>]*src="([^"]+)"/i)?.[1] ||
    html.match(/profile_background[^"]*"[^>]*src="([^"]+)"/i)?.[1] ||
    html.match(/id="profile_background"[^>]*src="([^"]+)"/i)?.[1] ||
    html.match(/has_profile_background[\s\S]{0,800}?url\(\s*['"]?([^'")]+)/i)?.[1] ||
    html.match(/background-image:\s*url\(\s*['"]?([^'")]+)/i)?.[1] ||
    "";
  return { image: safeAsset(absoluteSteamUrl(image)), video: "" };
}

function absoluteSteamUrl(value: string) {
  const raw = String(value || "").trim().replace(/^['"]|['"]$/g, "");
  if (!raw) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/steamcommunity/public/images/")) {
    return `https://cdn.cloudflare.steamstatic.com${raw}`;
  }
  if (raw.startsWith("images/")) {
    return `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/${raw}`;
  }
  if (raw.startsWith("items/") || raw.startsWith("economy/")) {
    return `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/${raw}`;
  }
  if (raw.startsWith("/")) return `https://cdn.cloudflare.steamstatic.com${raw}`;
  return raw;
}

type EquippedAsset = {
  image_large?: string;
  image_small?: string;
  movie_mp4?: string;
  movie_webm?: string;
  movie_mp4_small?: string;
  movie_webm_small?: string;
};

function assetFromEquipped(item?: EquippedAsset) {
  if (!item || (!item.image_large && !item.image_small && !item.movie_mp4 && !item.movie_webm)) {
    return { image: "", video: "" };
  }
  return {
    image: safeAsset(absoluteSteamUrl(item.image_large || item.image_small || "")),
    video: safeAsset(
      absoluteSteamUrl(item.movie_mp4 || item.movie_webm || item.movie_mp4_small || item.movie_webm_small || ""),
    ),
  };
}

async function fetchEquippedItems(steamId: string) {
  if (!config.steamApiKey || !/^\d{17}$/.test(steamId)) {
    return { profile: { image: "", video: "" }, mini: { image: "", video: "" } };
  }
  const url = new URL("https://api.steampowered.com/IPlayerService/GetProfileItemsEquipped/v1/");
  url.searchParams.set("key", config.steamApiKey);
  url.searchParams.set("steamid", steamId);
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return { profile: { image: "", video: "" }, mini: { image: "", video: "" } };
  const payload = (await response.json()) as {
    response?: {
      profile_background?: EquippedAsset;
      mini_profile_background?: EquippedAsset;
    };
  };
  return {
    profile: assetFromEquipped(payload.response?.profile_background),
    mini: assetFromEquipped(payload.response?.mini_profile_background),
  };
}

async function fetchEquippedBackground(steamId: string) {
  const items = await fetchEquippedItems(steamId);
  return items.profile;
}

const miniBackgroundCache = new Map<string, { at: number; image: string; video: string }>();

/** Fondo de miniperfil Steam, con caché corta. */
export async function resolveSteamMiniBackground(steamId: string) {
  if (!/^\d{17}$/.test(steamId)) return { image: "", video: "" };
  const cached = miniBackgroundCache.get(steamId);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) {
    return { image: cached.image, video: cached.video };
  }
  try {
    const items = await fetchEquippedItems(steamId);
    const mini = items.mini.image || items.mini.video ? items.mini : items.profile;
    miniBackgroundCache.set(steamId, { at: Date.now(), ...mini });
    return mini;
  } catch {
    miniBackgroundCache.set(steamId, { at: Date.now(), image: "", video: "" });
    return { image: "", video: "" };
  }
}

function parseRecentGames(html: string) {
  const games: SteamLibraryGame[] = [];
  for (const chunk of html.split('<div class="recent_game">').slice(1)) {
    const appId = chunk.match(/steamcommunity\.com\/app\/(\d+)/)?.[1];
    const name = decodeHtml(chunk.match(/<div class="game_name">[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)?.[1] || "");
    const details = decodeHtml(chunk.match(/<div class="game_info_details">([\s\S]*?)<\/div>/i)?.[1] || "");
    if (!appId || !name || games.some((game) => game.steamAppId === appId)) continue;
    const hoursMatch = details.match(/([\d][\d,]*(?:\.\d+)?)\s*hrs on record/i);
    const hours = hoursMatch ? Number(hoursMatch[1].replace(/,/g, "")) : 0;
    const played = details.match(/last played on\s+(.+)$/i)?.[1] || "";
    games.push(toGame(appId, name, Number.isFinite(hours) ? hours : 0, parsePlayedDate(played)));
  }
  return games;
}

async function fetchOwnedGames(steamId: string) {
  if (!config.steamApiKey) return null;
  const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
  url.searchParams.set("key", config.steamApiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "1");
  url.searchParams.set("include_played_free_games", "1");
  url.searchParams.set("include_free_sub", "1");
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    response?: { games?: { appid: number; name?: string; playtime_forever?: number; rtime_last_played?: number }[] };
  };
  const rows = payload.response?.games;
  if (!Array.isArray(rows)) return null;
  return rows
    .filter((row) => row.appid && row.name)
    .map((row) =>
      toGame(
        String(row.appid),
        row.name || `Steam ${row.appid}`,
        (row.playtime_forever || 0) / 60,
        (row.rtime_last_played || 0) * 1000,
      ),
    )
    .sort((a, b) => b.lastPlayedTimestamp - a.lastPlayedTimestamp || b.playTimeHours - a.playTimeHours);
}

function parseGameCount(html: string) {
  const match = html.match(/\/games\/\?tab=all">[\s\S]{0,320}?profile_count_link_total">\s*([\d,]+)/i);
  if (!match) return 0;
  const count = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(count) ? count : 0;
}

async function fetchCommunityGames(steamId: string) {
  const response = await fetch(`https://steamcommunity.com/profiles/${steamId}/games?tab=all&xml=1`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GameNow/1.0)",
      "Accept-Language": "en",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status !== 200) return null;
  const xml = await response.text();
  if (!xml.includes("<gamesList") && !xml.includes("<game>")) return null;
  const games: SteamLibraryGame[] = [];
  for (const block of xml.match(/<game>[\s\S]*?<\/game>/g) || []) {
    const appId = xmlValue(block, "appID");
    const name = xmlValue(block, "name");
    if (!appId || !name || games.some((game) => game.steamAppId === appId)) continue;
    const hours = Number(xmlValue(block, "hoursOnRecord").replace(/,/g, "")) || 0;
    const recent = xmlValue(block, "hoursLast2Weeks");
    games.push(toGame(appId, name, hours, recent ? Date.now() : 0));
  }
  return games;
}

export async function loadSteamAccount(steamId: string): Promise<SteamAccount> {
  if (!/^\d{17}$/.test(steamId)) {
    throw new Error("SteamID inválido.");
  }

  const profileUrl = `https://steamcommunity.com/profiles/${steamId}`;
  const [html, xml] = await Promise.all([
    fetchText(profileUrl),
    fetchText(`${profileUrl}/?xml=1`),
  ]);

  const steamName = xmlValue(xml, "steamID");
  const avatar = safeAsset(xmlValue(xml, "avatarFull")) || safeAsset(html.match(/property="og:image" content="([^"]+)"/i)?.[1] || "");
  if (!steamName || !avatar) {
    throw new Error("Steam no publicó el perfil.");
  }

  const htmlBackground = parseBackground(html);
  const equippedBackground = await fetchEquippedBackground(steamId).catch(() => ({ image: "", video: "" }));
  const background = {
    image: equippedBackground.image || htmlBackground.image,
    video: equippedBackground.video || htmlBackground.video,
  };
  const steamGameCount = parseGameCount(html);
  const [owned, community] = await Promise.all([
    fetchOwnedGames(steamId).catch(() => null),
    fetchCommunityGames(steamId).catch(() => null),
  ]);
  const steamGames =
    (owned && owned.length ? owned : null) ||
    (community && community.length ? community : null) ||
    parseRecentGames(html);

  return {
    steamId,
    steamName,
    steamAvatarUrl: avatar,
    steamFrameUrl: parseFrame(html),
    steamBackgroundUrl: background.image,
    steamBackgroundVideo: background.video,
    steamGameCount,
    steamGames,
  };
}

/** Perfil público de Steam, sin bajar la biblioteca completa. */
export async function loadSteamVisit(steamId: string) {
  if (!/^\d{17}$/.test(steamId)) {
    throw new Error("SteamID inválido.");
  }

  const profileUrl = `https://steamcommunity.com/profiles/${steamId}`;
  const [html, xml] = await Promise.all([fetchText(profileUrl), fetchText(`${profileUrl}/?xml=1`)]);
  const steamName = xmlValue(xml, "steamID");
  const avatar = safeAsset(xmlValue(xml, "avatarFull")) || safeAsset(html.match(/property="og:image" content="([^"]+)"/i)?.[1] || "");
  if (!steamName || !avatar) {
    throw new Error("Steam no publicó el perfil.");
  }

  const background = parseBackground(html);
  const equippedBackground = await fetchEquippedBackground(steamId).catch(() => ({ image: "", video: "" }));
  return {
    kind: "steam" as const,
    steamId,
    name: steamName,
    steamName,
    avatarUrl: avatar,
    frameUrl: parseFrame(html),
    backgroundUrl: equippedBackground.image || background.image,
    backgroundVideo: equippedBackground.video || background.video,
    gameCount: parseGameCount(html),
    totalHours: 0,
    games: parseRecentGames(html).slice(0, 12),
  };
}

const backgroundCache = new Map<string, { at: number; image: string; video: string }>();

/** Fondo de perfil Steam (imagen/video), con caché corta. */
export async function resolveSteamBackground(steamId: string) {
  if (!/^\d{17}$/.test(steamId)) return { image: "", video: "" };
  const cached = backgroundCache.get(steamId);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) {
    return { image: cached.image, video: cached.video };
  }
  try {
    const equipped = await fetchEquippedBackground(steamId);
    if (equipped.image || equipped.video) {
      backgroundCache.set(steamId, { at: Date.now(), ...equipped });
      return equipped;
    }
    const profile = await loadSteamVisit(steamId);
    const result = { image: profile.backgroundUrl || "", video: profile.backgroundVideo || "" };
    backgroundCache.set(steamId, { at: Date.now(), ...result });
    return result;
  } catch {
    backgroundCache.set(steamId, { at: Date.now(), image: "", video: "" });
    return { image: "", video: "" };
  }
}
