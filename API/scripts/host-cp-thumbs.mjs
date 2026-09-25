import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

// Versiones comprimidas del presskit cuando el original supera el limite de Cloudinary
const jobs = [
  ["cp-5th-16x9", "https://press.cdn.cdpr.app/media/assets/812/Cyberpunk2077_5thAnniversary_KV_16x9_4k_EN_q90_680x680.png"],
  ["cp-phl-art", "https://press.cdn.cdpr.app/media/assets/721/PhL_q90_680x680.png"],
  ["cp-ps5-jackie", "https://press.cdn.cdpr.app/media/assets/817/Cyberpunk2077_PS5_Pro_Jackie_CLEAN_q90_680x680.png"],
  ["cp-ps5-clean", "https://press.cdn.cdpr.app/media/assets/817/Cyberpunk2077_PS5_Pro_CLEAN_q90_680x680.png"],
  ["cp-mac-create", "https://press.cdn.cdpr.app/media/assets/808/Cyberpunk2077_Mac_Create_your_own_cyberpunk_CLEAN_EN.jpeg"],
];

for (const [name, url] of jobs) {
  try {
    const result = await cloudinary.uploader.upload(url, {
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
