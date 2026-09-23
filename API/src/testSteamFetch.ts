async function test() {
  const inputs = ["diegobanuelos", "76561198000000000", "gaben"];
  for (const input of inputs) {
    try {
      const url = `https://steamcommunity.com/id/${input}/games?tab=all&xml=1`;
      console.log("Fetching", url);
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      console.log("Status:", res.status);
      const text = await res.text();
      console.log("Length:", text.length, "Preview:", text.slice(0, 200));
    } catch (e) {
      console.error("Error for", input, e);
    }
  }
}
test();
