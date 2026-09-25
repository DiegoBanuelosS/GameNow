const ids = process.argv.slice(2);
for (const id of ids) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.log("fail", id, res.status);
      continue;
    }
    const data = await res.json();
    console.log(id, "|", data.author_name, "|", data.title);
  } catch (error) {
    console.log("fail", id, error.message);
  }
}
