import { config } from "./config.js";

export type NewsItem = {
  id: string;
  game: string;
  appId: string;
  slug?: string;
  title: string;
  author: string;
  date: string;
  dateTs: number;
  url: string;
  snippet: string;
  body: string;
  image: string;
};

type SteamNewsItem = {
  gid?: string;
  title?: string;
  url?: string;
  author?: string;
  contents?: string;
  date?: number;
  feedlabel?: string;
  appid?: number;
};

const newsCache = new Map<string, { at: number; items: NewsItem[] }>();
const CACHE_VERSION = "bbcode-html-v4";

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return "";
}

/** Convierte BBCode / markup de Steam a HTML seguro para la vista extendida. */
export function steamMarkupToHtml(raw: string) {
  let s = String(raw || "");

  s = s.replace(/\{STEAM_CLAN_IMAGE\}([^/\s}]+)\/([^\s}\]]+)/gi, (_m, clan, file) => {
    return `https://clan.akamai.steamstatic.com/images/${clan}/${file}`;
  });

  const looksLikeHtml = /<\/?(?:p|h1|h2|h3|ul|ol|li|br|strong|em|b|i|img|a)\b/i.test(s);
  if (!looksLikeHtml) {
    s = escapeHtml(s);
  }

  // Encabezados literales de Steam: \[ RUSH ] / \[ GAMEPLAY ]
  s = s.replace(/\\\[([^\]]+)\]/g, (_m, label) => `<h3>${String(label).trim()}</h3>`);

  s = s
    .replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_m, src) => {
      const url = safeUrl(decodeEntities(String(src).replace(/&quot;/g, '"').replace(/&amp;/g, "&")));
      return url ? `<img src="${url}" alt="" loading="lazy" />` : "";
    })
    .replace(/\[url=(https?:\/\/[^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_m, href, label) => {
      const url = safeUrl(href);
      return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>` : String(label);
    })
    .replace(/\[url\](https?:\/\/[^\[]+)\[\/url\]/gi, (_m, href) => {
      const url = safeUrl(href);
      return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>` : "";
    })
    .replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, "<h1>$1</h1>")
    .replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, "<h2>$1</h2>")
    .replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, "<h3>$1</h3>")
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>")
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>")
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>")
    .replace(/\[strike\]([\s\S]*?)\[\/strike\]/gi, "<s>$1</s>")
    .replace(/\[p\]\s*\[\/p\]/gi, "")
    .replace(/\[p\]([\s\S]*?)\[\/p\]/gi, "<p>$1</p>")
    .replace(/\[quote(?:=[^\]]*)?\]([\s\S]*?)\[\/quote\]/gi, "<blockquote>$1</blockquote>")
    .replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, "<details><summary>Spoiler</summary>$1</details>")
    .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, "<pre><code>$1</code></pre>")
    .replace(/\[hr\]\s*\[\/hr\]/gi, "<hr />")
    .replace(/\[hr\s*\/?\]/gi, "<hr />")
    .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_m, inner) => {
      const items = String(inner)
        .replace(/\[\*\]([\s\S]*?)(?:\[\/\*\]|(?=\[\*\])|$)/gi, "<li>$1</li>")
        .replace(/\[\/\*\]/gi, "")
        .trim();
      return `<ul>${items}</ul>`;
    })
    .replace(/\[olist\]([\s\S]*?)\[\/olist\]/gi, (_m, inner) => {
      const items = String(inner)
        .replace(/\[\*\]([\s\S]*?)(?:\[\/\*\]|(?=\[\*\])|$)/gi, "<li>$1</li>")
        .replace(/\[\/\*\]/gi, "")
        .trim();
      return `<ol>${items}</ol>`;
    })
    .replace(/\[\*\]/gi, "")
    .replace(/\[\/\*\]/gi, "")
    .replace(/\[\/?(?:previewyoutube|dynamiclink|expand)[^\]]*\]/gi, "")
    .replace(/\\[\[\]]/g, "")
    .replace(/\[(\/?(?:h1|h2|h3|p|b|i|u|list|olist|\*|quote|spoiler|code|img|url|hr)[^\]]*)\]/gi, "")
    .replace(/<br\s*\/?>/gi, "<br />")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  s = s.replace(
    /(^|[^"'>=])(https:\/\/clan\.akamai\.steamstatic\.com\/images\/[^\s<]+)/gi,
    (_m, before, url) => `${before}<img src="${url}" alt="" loading="lazy" />`,
  );

  // Limpiar <p> anidados dentro de <li> / encabezados envueltos en <p>
  s = s
    .replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/gi, "<li>$1</li>")
    .replace(/<p>\s*(<(?:h1|h2|h3)\b[^>]*>[\s\S]*?<\/(?:h1|h2|h3)>)\s*<\/p>/gi, "$1")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/(<\/(?:h1|h2|h3|ul|ol|blockquote)>)\s*(<(?:h1|h2|h3|ul|ol|blockquote)\b)/gi, "$1$2");

  if (!/<(?:p|h1|h2|h3|ul|ol|blockquote|img|br)\b/i.test(s) && s) {
    s = `<p>${s.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br />")}</p>`;
  }

  return s;
}

function toPlainText(htmlOrBbcode: string) {
  return decodeEntities(
    steamMarkupToHtml(htmlOrBbcode)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(?:p|h1|h2|h3|li|blockquote)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function firstImage(html: string) {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    const src = imgMatch[1];
    return src.startsWith("//") ? `https:${src}` : src;
  }
  const bbMatch = html.match(/\[img\]([^\[]+)\[\/img\]/i);
  if (bbMatch?.[1]) {
    const src = bbMatch[1].trim();
    if (src.startsWith("//")) return `https:${src}`;
    if (/^https?:\/\//i.test(src)) return src;
  }
  const clan = html.match(/\{STEAM_CLAN_IMAGE\}([^/\s}]+)\/([^\s}\]]+)/i);
  if (clan) return `https://clan.akamai.steamstatic.com/images/${clan[1]}/${clan[2]}`;
  return "";
}

function formatDate(ts: number) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function steamCover(appId: string) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

async function fetchAppNews(appId: string, gameName: string, count = 2): Promise<NewsItem[]> {
  const cacheKey = `${CACHE_VERSION}:${appId}`;
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 20 * 60 * 1000) return cached.items;

  const url = new URL("https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/");
  url.searchParams.set("appid", appId);
  url.searchParams.set("count", String(count));
  url.searchParams.set("maxlength", "0");
  url.searchParams.set("format", "json");
  if (config.steamApiKey) url.searchParams.set("key", config.steamApiKey);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      newsCache.set(cacheKey, { at: Date.now(), items: [] });
      return [];
    }
    const payload = (await response.json()) as {
      appnews?: { newsitems?: SteamNewsItem[] };
    };
    const items = (payload.appnews?.newsitems ?? [])
      .filter((item) => item.title && item.url)
      .map((item) => {
        const contents = String(item.contents || "");
        const image = firstImage(contents) || steamCover(appId);
        const body = steamMarkupToHtml(contents);
        const plain = toPlainText(contents);
        const snippet = plain.slice(0, 220);
        return {
          id: `steam-${appId}-${item.gid || item.date || item.title}`,
          game: gameName,
          appId,
          title: String(item.title),
          author: String(item.author || item.feedlabel || "Steam"),
          date: formatDate(Number(item.date) || 0),
          dateTs: Number(item.date) || 0,
          url: String(item.url),
          snippet: snippet || "Nueva actualización disponible en Steam.",
          body: body || `<p>${snippet || "Nueva actualización disponible en Steam."}</p>`,
          image,
        } satisfies NewsItem;
      });
    newsCache.set(cacheKey, { at: Date.now(), items });
    return items;
  } catch {
    newsCache.set(cacheKey, { at: Date.now(), items: [] });
    return [];
  }
}

export async function loadSteamNewsForApps(
  apps: { appId: string; name: string }[],
  perApp = 2,
  limit = 24,
) {
  const unique = new Map<string, string>();
  for (const app of apps) {
    if (/^\d+$/.test(app.appId) && !unique.has(app.appId)) {
      unique.set(app.appId, app.name || `App ${app.appId}`);
    }
  }
  const entries = [...unique.entries()].slice(0, 16);
  const batches: NewsItem[][] = [];
  const concurrency = 4;
  for (let i = 0; i < entries.length; i += concurrency) {
    const slice = entries.slice(i, i + concurrency);
    const part = await Promise.all(slice.map(([appId, name]) => fetchAppNews(appId, name, perApp)));
    batches.push(...part);
  }
  return batches
    .flat()
    .sort((a, b) => b.dateTs - a.dateTs)
    .slice(0, limit);
}
