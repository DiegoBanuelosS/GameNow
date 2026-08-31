const warmed = new Set<string>();

export function warmupVideos(urls: string[]) {
  for (const url of urls) {
    const source = url.trim();
    if (!source || warmed.has(source)) {
      continue;
    }
    warmed.add(source);
    void fetch(source, { cache: "force-cache", mode: "same-origin" }).catch(() => {
      warmed.delete(source);
    });
  }
}
