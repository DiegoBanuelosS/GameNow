import { v2 as cloudinary } from "cloudinary";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { requireCloudinary } from "../src/config.js";
import { connectDb } from "../src/db.js";
import { Product } from "../src/models/Product.js";
import { Setting } from "../src/models/Setting.js";
import { products, siteAssets } from "./catalog.js";

const creds = requireCloudinary();
cloudinary.config({
  cloud_name: creds.cloudName,
  api_key: creds.apiKey,
  api_secret: creds.apiSecret,
  secure: true,
});

type Asset = {
  publicId: string;
  resourceType: "image" | "video";
  local: string;
  hosted: boolean;
};

const cache = new Map<string, Asset>();

function localUrl(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const relative = normalized.split("/public/")[1] || normalized;
  return `/${relative}`;
}

function publicIdFor(kind: string, filePath: string) {
  const stem = basename(filePath, extname(filePath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return `gamenow/${kind}/${stem}`;
}

async function uploadFile(filePath: string, kind: "covers" | "logos" | "trailers" | "site") {
  const hit = cache.get(filePath);
  if (hit) {
    return hit;
  }

  const ext = extname(filePath).toLowerCase();
  const isVideo = ext === ".webm" || ext === ".mp4";
  const publicId = publicIdFor(kind, filePath);
  const resourceType = isVideo ? "video" : "image";
  const local = localUrl(filePath);

  const options = {
    public_id: publicId,
    resource_type: resourceType,
    overwrite: true,
    invalidate: true,
    unique_filename: false,
    use_filename: false,
    ...(isVideo
      ? {
          chunk_size: 6_000_000,
        }
      : ext === ".svg"
        ? {}
        : {
            format: "webp",
            quality: "auto:good",
            eager: [
              { width: 1600, crop: "limit", quality: "auto:good", fetch_format: "auto" },
              { width: 800, crop: "limit", quality: "auto:good", fetch_format: "auto" },
            ],
            eager_async: true,
          }),
  } as const;

  console.log(`upload ${resourceType} ${publicId}`);
  try {
    const result = await cloudinary.uploader.upload(filePath, options);
    if (!result.public_id) {
      throw new Error("Cloudinary no devolvió public_id");
    }
    const asset: Asset = { publicId: result.public_id, resourceType, local, hosted: true };
    cache.set(filePath, asset);
    return asset;
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload failed";
    console.warn(`Cloudinary omitió ${publicId}: ${message}`);
    const asset: Asset = { publicId, resourceType, local, hosted: false };
    cache.set(filePath, asset);
    return asset;
  }
}

async function main() {
  const docs = [];
  for (const product of products) {
    const cover = await uploadFile(product.cover, "covers");
    const studioLogo = product.studioLogo
      ? await uploadFile(product.studioLogo, "logos")
      : undefined;
    const trailer = product.trailer ? await uploadFile(product.trailer, "trailers") : undefined;
    docs.push({
      slug: product.slug,
      name: product.name,
      studio: product.studio,
      alt: product.alt,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      currency: "MXN",
      sections: product.sections,
      cover,
      studioLogo,
      trailer,
    });
  }

  const authPanel = await uploadFile(siteAssets.authPanel, "site");
  const site = { key: "site", authPanel };

  await mkdir(resolve(process.cwd(), "data"), { recursive: true });
  await writeFile(resolve(process.cwd(), "data/catalog.json"), `${JSON.stringify(docs, null, 2)}\n`);
  await writeFile(resolve(process.cwd(), "data/site.json"), `${JSON.stringify(site, null, 2)}\n`);

  const connected = await connectDb();
  if (connected) {
    await Product.deleteMany({});
    await Product.insertMany(docs);
    await Setting.findOneAndUpdate({ key: "site" }, site, { upsert: true });
    console.log(`Mongo: ${docs.length} productos`);
  } else {
    console.log("Snapshot listo. Confirma el usuario de Atlas o añade MONGODB_URI y vuelve a correr npm run seed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
