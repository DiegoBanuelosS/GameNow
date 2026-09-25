import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

const dir = join(tmpdir(), "gamenow-cp");
mkdirSync(dir, { recursive: true });

const jobs = [
  ["cp-5th-16x9", "https://press.cdn.cdpr.app/media/assets/812/Cyberpunk2077_5thAnniversary_KV_16x9_4k_EN.png"],
  ["cp-phl-art", "https://press.cdn.cdpr.app/media/assets/721/PhL.png"],
  ["cp-ps5-jackie", "https://press.cdn.cdpr.app/media/assets/817/Cyberpunk2077_PS5_Pro_Jackie_CLEAN.png"],
  // Caratula vertical: Steam library (oficial) como respaldo del cover press
  ["cyberpunk-2077-cover", "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/library_600x900_2x.jpg"],
];

for (const [name, url] of jobs) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GameNow/1.0" },
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const out = join(dir, `${name}.jpg`);
    await sharp(buf)
      .rotate()
      .resize({ width: 2560, height: 1440, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(out);
    const result = await cloudinary.uploader.upload(out, {
      public_id: `gamenow/presskit/${name}`,
      resource_type: "image",
      overwrite: true,
      timeout: 180000,
    });
    console.log("ok", result.public_id, result.width + "x" + result.height);
  } catch (error) {
    console.log("fail", name, error?.message || error);
  }
}

try {
  rmSync(dir, { recursive: true, force: true });
} catch {
  /* ignore */
}
