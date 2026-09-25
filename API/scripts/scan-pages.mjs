const urls = process.argv.slice(2);
for (const url of urls) {
  try {
    const html = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) })).text();
    const found = html.match(/https?:[^"'\\\s>]+\.(?:jpg|jpeg|png|webp)/gi) || [];
    const media = [...new Set(found)].filter((item) => !/icon|logo|favicon|sprite|svg|1x1|pixel/i.test(item));
    console.log("\n#", url, media.length);
    console.log(media.slice(0, 12).join("\n") || "none");
  } catch (error) {
    console.log("\n#", url, error.message);
  }
}
