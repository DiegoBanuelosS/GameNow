const jobs = [
  ["https://www.callofduty.com/modernwarfare4", /imgs\.callofduty\.com[^"'\\\s]+/g],
  ["https://www.playstation.com/en-us/games/the-last-of-us-part-ii-remastered/", /image\.api\.playstation\.com[^"'\\\s]+/g],
  ["https://www.arcraiders.com/", /assets\.arcraiders\.com[^"'\\\s]+\.(?:jpg|png|webp)/g],
];
for (const [url, re] of jobs) {
  const html = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) })).text();
  const found = [...new Set(html.match(re) || [])];
  console.log("\n#", url, found.length);
  console.log(found.slice(0, 15).join("\n") || "none");
}
