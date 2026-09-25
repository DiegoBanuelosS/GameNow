import { cacheGet, cacheSet } from "./cache.js";

const UA = "GameNow/1.0 (https://github.com/GameNow; store details)";

export type SteamExtras = {
  name: string;
  description: string;
  developers: string[];
  release: string;
  header: string;
  requirements: {
    minimum?: string;
    recommended?: string;
  };
  screenshots: string[];
  videos: { src: string; poster?: string; sources?: { src: string; type: string }[] }[];
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

async function movieExists(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function loadSteamExtras(appId: string): Promise<SteamExtras | null> {
  if (!appId) {
    return null;
  }
  const key = `steam-v5-${appId}`;
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
          name?: string;
          short_description?: string;
          developers?: string[];
          header_image?: string;
          release_date?: { date?: string };
          pc_requirements?: { minimum?: string; recommended?: string };
          screenshots?: { path_full?: string }[];
          movies?: {
            id?: number;
            mp4?: { max?: string; "480"?: string };
            hls_h264?: string;
            thumbnail?: string;
          }[];
        };
      }
    >;
    const entry =
      payload[appId] ??
      Object.values(payload).find((item) => item?.success && item.data);
    if (!entry?.success || !entry.data) {
      return cacheSet(key, null, 10 * 60 * 1000);
    }
    const data = entry.data;
    const extras: SteamExtras = {
      name: data.name || "",
      description: plain(data.short_description || ""),
      developers: data.developers ?? [],
      header: (data.header_image || "").replace(/^http:/, "https:"),
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
      videos: (
        await Promise.all(
          (data.movies ?? []).slice(0, 4).map(async (movie) => {
            const base = movie.id
              ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${movie.id}`
              : "";
            const candidates = [
              movie.mp4?.["480"]?.replace(/^http:/, "https:"),
              base ? `${base}/movie480.mp4` : "",
              movie.mp4?.max?.replace(/^http:/, "https:"),
              base ? `${base}/movie_max.mp4` : "",
            ].filter((src, index, list): src is string => Boolean(src) && list.indexOf(src) === index);
            const live: string[] = [];
            for (const src of candidates) {
              if (await movieExists(src)) {
                live.push(src);
              }
            }
            const hls = movie.hls_h264?.replace(/^http:/, "https:") || "";
            const src = live[0] || hls;
            return {
              src,
              poster: movie.thumbnail,
              sources: live.length
                ? live.map((file) => ({ src: file, type: "video/mp4" }))
                : hls
                  ? [{ src: hls, type: "application/vnd.apple.mpegurl" }]
                  : [],
            };
          }),
        )
      )
        .filter((movie) => movie.src)
        .slice(0, 3),
    };
    return cacheSet(key, extras, 60 * 60 * 1000);
  } catch {
    return cacheSet(key, null, 5 * 60 * 1000);
  }
}
