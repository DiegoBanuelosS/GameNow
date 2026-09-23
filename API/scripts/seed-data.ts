import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { connectDb } from "../src/db.js";
import { Game } from "../src/models/Game.js";
import { Product } from "../src/models/Product.js";
import { Setting } from "../src/models/Setting.js";

type Doc = Record<string, unknown> & { slug?: string; key?: string };

async function readJson<T>(name: string): Promise<T> {
  const raw = await readFile(resolve(process.cwd(), "data", name), "utf8");
  return JSON.parse(raw) as T;
}

function upsertBySlug(docs: Doc[]) {
  return docs.map((doc) => ({
    updateOne: {
      filter: { slug: doc.slug },
      update: { $set: doc },
      upsert: true,
    },
  }));
}

async function main() {
  const connected = await connectDb();
  if (!connected) {
    throw new Error("Falta MONGODB_URI en API/.env");
  }

  const [products, games, site] = await Promise.all([
    readJson<Doc[]>("catalog.json"),
    readJson<Doc[]>("games.json"),
    readJson<Doc>("site.json"),
  ]);

  const [productResult, gameResult] = await Promise.all([
    Product.bulkWrite(upsertBySlug(products), { ordered: false }),
    Game.bulkWrite(upsertBySlug(games), { ordered: false }),
    Setting.updateOne({ key: site.key || "site" }, { $set: site }, { upsert: true }),
  ]);

  const [productCount, gameCount, settingCount] = await Promise.all([
    Product.countDocuments(),
    Game.countDocuments(),
    Setting.countDocuments(),
  ]);

  console.log(
    `products upserted=${productResult.upsertedCount} modified=${productResult.modifiedCount} total=${productCount}`,
  );
  console.log(
    `games upserted=${gameResult.upsertedCount} modified=${gameResult.modifiedCount} total=${gameCount}`,
  );
  console.log(`settings total=${settingCount}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
