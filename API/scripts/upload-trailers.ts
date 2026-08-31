import { v2 as cloudinary } from "cloudinary";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireCloudinary } from "../src/config.js";

const creds = requireCloudinary();
cloudinary.config({
  cloud_name: creds.cloudName,
  api_key: creds.apiKey,
  api_secret: creds.apiSecret,
  secure: true,
});

const catalogPath = resolve(process.cwd(), "data/catalog.json");
const docs = JSON.parse(await readFile(catalogPath, "utf8")) as Array<{
  trailer?: { publicId: string; resourceType: string; local: string; hosted: boolean };
}>;

for (const doc of docs) {
  const trailer = doc.trailer;
  if (!trailer || trailer.hosted) {
    continue;
  }
  const filePath = resolve(process.cwd(), "../WWW/public", trailer.local.replace(/^\//, ""));
  console.log(`upload video ${trailer.publicId}`);
  const result = await cloudinary.uploader.upload(filePath, {
    public_id: trailer.publicId,
    resource_type: "video",
    overwrite: true,
    invalidate: true,
    chunk_size: 6_000_000,
  });
  if (!result.public_id) {
    throw new Error(`Sin public_id: ${trailer.publicId}`);
  }
  trailer.publicId = result.public_id;
  trailer.hosted = true;
  console.log(`ok ${result.public_id} ${result.bytes}`);
  await writeFile(catalogPath, `${JSON.stringify(docs, null, 2)}\n`);
}

console.log("trailers listos");
