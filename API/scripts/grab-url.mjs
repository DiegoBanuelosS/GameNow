const url = process.argv[2];
const needle = process.argv[3] || ".mp4";
const html = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) })).text();
const loose = [...html.matchAll(new RegExp(`.{160}${needle.replace(".", "\\.")}`, "gi"))].slice(0, 3).map((m) => m[0]);
console.log(loose.join("\n---\n") || "none");
