import { readFileSync, writeFileSync } from "node:fs";
import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));

function compact(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}

function sameTitle(productName, otherName) {
  const product = compact(productName);
  const other = compact(otherName);
  if (!product || !other || product !== other) {
    const extra = product.startsWith(other) ? product.slice(other.length) : other.startsWith(product) ? other.slice(product.length) : "";
    if (!/^(remastered|remaster|ultimateedition|ultimate|definitiveedition|definitive|completeedition|complete|gameoftheyear|goty|deluxeedition|deluxe)/.test(extra)) {
      return false;
    }
  }
  return product.length > 2 && other.length > 2;
}

const press = {
  "gta-vi": {
    cover: "https://www.rockstargames.com/VI/-/opengraph-image.jpg",
    trailer: "https://www.rockstargames.com/VI/_next/static/media/1920_hvec.0xonioic6s5d5.mp4",
  },
  "forza-horizon-6": {
    cover: "https://cdn.forza.net/strapi-uploads/assets/Forza_Horizon_6_3840x2160_Hori_Final_ac7b0063ff.jpg",
    shots: [
      "https://cdn.forza.net/strapi-uploads/assets/FH_6_S05_Key_Art_3840x2160_fb8afcde8d.jpg",
    ],
  },
  "007-first-light": {
    cover: "https://cms.ioi.dk/media/mhiniewk/key-art-accolades-web-01.jpg?width=2560",
  },
};

async function steamMedia(name, screenshots) {
  const id = (screenshots ?? []).map((url) => url.match(/\/apps\/(\d+)\//)?.[1]).find(Boolean);
  if (!id) return null;
  const endpoint = new URL("https://store.steampowered.com/api/appdetails");
  endpoint.searchParams.set("appids", id);
  endpoint.searchParams.set("l", "english");
  const response = await fetch(endpoint, { headers: { "User-Agent": "GameNow/1.0" } });
  const payload = await response.json();
  const data = payload[id]?.data || Object.values(payload).find((item) => item?.success)?.data;
  if (!data?.name || !sameTitle(name, data.name)) return null;
  const mp4 = data.movies?.[0]?.mp4?.max || data.movies?.[0]?.mp4?.["480"] || "";
  return {
    cover: data.header_image,
    trailer: mp4.replace(/^http:/, "https:"),
    shots: (data.screenshots ?? []).slice(0, 4).map((shot) => shot.path_full).filter(Boolean),
  };
}

async function upload(url, publicId, resourceType) {
  if (!url) return "";
  const result = await cloudinary.uploader.upload(url, {
    public_id: publicId,
    resource_type: resourceType,
    overwrite: true,
    timeout: 120000,
  });
  console.log("ok", publicId);
  return result.public_id;
}

const hosted = {};
for (const product of catalog) {
  const fromPress = press[product.slug] ?? {};
  let fromSteam = null;
  try {
    fromSteam = await steamMedia(product.name, product.screenshots);
  } catch (error) {
    console.log("steam skip", product.slug, error.message);
  }
  const cover = fromPress.cover || fromSteam?.cover || "";
  const trailer = fromPress.trailer || fromSteam?.trailer || "";
  const shots = fromPress.shots || fromSteam?.shots || [];
  const entry = { cover: "", trailer: "", shots: [] };
  try {
    entry.cover = await upload(cover, `gamenow/press/${product.slug}-cover`, "image");
  } catch (error) {
    console.log("cover fail", product.slug, error.message);
  }
  try {
    entry.trailer = await upload(trailer, `gamenow/press/${product.slug}-trailer`, "video");
  } catch (error) {
    console.log("trailer fail", product.slug, error.message);
  }
  for (const [index, shot] of shots.slice(0, 3).entries()) {
    try {
      const id = await upload(shot, `gamenow/press/${product.slug}-shot-${index + 1}`, "image");
      if (id) entry.shots.push(id);
    } catch (error) {
      console.log("shot fail", product.slug, error.message);
    }
  }
  hosted[product.slug] = entry;
  console.log(product.slug, entry.cover ? "cover" : "no-cover", entry.trailer ? "trailer" : "no-trailer");
}

writeFileSync(new URL("../data/hosted-press.json", import.meta.url), JSON.stringify(hosted, null, 2));
console.log("wrote hosted-press.json");
