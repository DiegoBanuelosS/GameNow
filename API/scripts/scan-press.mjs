const url = process.argv[2];
const html = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) })).text();
const og = html.match(/property="og:image" content="([^"]+)/);
console.log("og", og?.[1] || "");
const imgs = [...new Set(html.match(/https?:[^"'\\\s>]+\.(?:jpg|jpeg|png|webp)/gi) || [])];
console.log(imgs.slice(0, 20).join("\n") || "none");
