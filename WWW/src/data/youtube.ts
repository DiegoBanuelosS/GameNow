const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

export function youtubeId(src?: string) {
  const value = src?.trim() || "";
  if (!value) {
    return "";
  }
  try {
    const url = new URL(value);
    if (!YOUTUBE_HOSTS.has(url.hostname)) {
      return "";
    }
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1, 12);
    }
    if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
      return url.pathname.split("/")[2]?.slice(0, 11) || "";
    }
    return url.searchParams.get("v")?.slice(0, 11) || "";
  } catch {
    return "";
  }
}

export function youtubeEmbed(id: string, options?: { muted?: boolean; controls?: boolean }) {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (options?.muted !== false) {
    params.set("mute", "1");
  }
  if (options?.controls === false) {
    params.set("controls", "0");
    params.set("loop", "1");
    params.set("playlist", id);
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function youtubePoster(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
