import { cacheGet, cacheSet } from "./cache.js";

const UA = "GameNow/1.0 (https://github.com/GameNow; store details)";

export type SteamExtras = {
  description: string;
  developers: string[];
  release: string;
  requirements: {
    minimum?: string;
    recommended?: string;
  };
  screenshots: string[];
  videos: { src: string; poster?: string }[];
};

function plain(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function loadSteamExtras(appId: string): Promise<SteamExtras | null> {
  if (!appId) {
    return null;
  }
  const key = `steam-${appId}`;
  const cached = cacheGet<SteamExtras | null>(key);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const url = new URL("https://store.steampowered.com/api/appdetails");
    url.searchParams.set("appids", appId);
    url.searchParams.set("cc", "mx");
    url.searchParams.set("l", "spanish");
    const response = await fetch(url, { headers: { "User-Agent": UA } });
    if (!response.ok) {
      throw new Error(String(response.status));
    }
    const payload = (await response.json()) as Record<
      string,
      {
        success?: boolean;
        data?: {
          short_description?: string;
          developers?: string[];
          release_date?: { date?: string };
          pc_requirements?: { minimum?: string; recommended?: string };
          screenshots?: { path_full?: string }[];
          movies?: {
            id?: number;
            mp4?: { max?: string; "480"?: string };
            thumbnail?: string;
          }[];
        };
      }
    >;
    const entry = payload[appId];
    if (!entry?.success || !entry.data) {
      return cacheSet(key, null, 10 * 60 * 1000);
    }
    const data = entry.data;
    const extras: SteamExtras = {
      description: plain(data.short_description || ""),
      developers: data.developers ?? [],
      release: data.release_date?.date || "",
      requirements: {
        minimum: data.pc_requirements?.minimum
          ? plain(data.pc_requirements.minimum)
          : undefined,
        recommended: data.pc_requirements?.recommended
          ? plain(data.pc_requirements.recommended)
          : undefined,
      },
      screenshots: (data.screenshots ?? [])
        .map((shot) => shot.path_full || "")
        .filter(Boolean)
        .slice(0, 8),
      videos: (data.movies ?? [])
        .map((movie) => ({
          src:
            movie.mp4?.max ||
            movie.mp4?.["480"] ||
            (movie.id
              ? `https://cdn.akamai.steamstatic.com/steam/apps/${movie.id}/movie_max.mp4`
              : ""),
          poster: movie.thumbnail,
        }))
        .filter((movie) => movie.src)
        .slice(0, 3),
    };
    return cacheSet(key, extras, 60 * 60 * 1000);
  } catch {
    return cacheSet(key, null, 5 * 60 * 1000);
  }
}
