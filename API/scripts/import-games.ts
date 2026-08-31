import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Deal = {
  title: string;
  salePrice: string;
  normalPrice: string;
  steamAppID: string;
  metacriticScore: string;
  steamRatingText: string;
  savings: string;
  thumb: string;
};

const UA = "GameNow/1.0 (https://github.com/GameNow; catalog import)";
const TARGET = 1000;

function slugify(title: string, appId: string) {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `steam-${appId}`;
}

async function fetchPage(page: number, sortBy: string) {
  const url = new URL("https://www.cheapshark.com/api/1.0/deals");
  url.searchParams.set("storeID", "1");
  url.searchParams.set("pageSize", "60");
  url.searchParams.set("pageNumber", String(page));
  url.searchParams.set("sortBy", sortBy);
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) {
    throw new Error(`CheapShark ${response.status}`);
  }
  return (await response.json()) as Deal[];
}

async function main() {
  const seen = new Map<string, Deal>();
  const sorts = ["Metacritic", "Savings", "Recent", "Reviews", "Release", "Deal Rating"];

  for (const sortBy of sorts) {
    for (let page = 0; page < 25 && seen.size < TARGET; page += 1) {
      const deals = await fetchPage(page, sortBy);
      if (!deals.length) {
        break;
      }
      for (const deal of deals) {
        if (!deal.steamAppID || !deal.title || seen.has(deal.steamAppID)) {
          continue;
        }
        seen.set(deal.steamAppID, deal);
        if (seen.size >= TARGET) {
          break;
        }
      }
      console.log(`${sortBy} p${page} → ${seen.size}`);
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    if (seen.size >= TARGET) {
      break;
    }
  }

  const slugs = new Set<string>();
  const games = [...seen.values()]
    .sort((a, b) => Number(b.metacriticScore || 0) - Number(a.metacriticScore || 0))
    .slice(0, TARGET)
    .map((deal) => {
      let slug = slugify(deal.title, deal.steamAppID);
      if (slugs.has(slug)) {
        slug = `${slug}-${deal.steamAppID}`;
      }
      slugs.add(slug);
      const price = Number(deal.salePrice);
      const was = Number(deal.normalPrice);
      const metacritic = Number(deal.metacriticScore) || 0;
      return {
        slug,
        steamAppId: deal.steamAppID,
        name: deal.title,
        alt: deal.title,
        price,
        compareAtPrice: was > price ? was : undefined,
        metacritic,
        steamRating: deal.steamRatingText || "",
        source: "cheapshark-steam",
      };
    });

  if (games.length < TARGET) {
    throw new Error(`Solo se importaron ${games.length} juegos reales; se pedían ${TARGET}.`);
  }

  await mkdir(resolve(process.cwd(), "data"), { recursive: true });
  await writeFile(resolve(process.cwd(), "data/games.json"), `${JSON.stringify(games, null, 2)}\n`);
  console.log(`importados ${games.length} juegos de Steam/CheapShark`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
