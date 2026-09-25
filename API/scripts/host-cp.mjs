import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

// Assets publicos del Press Center CDPR (press.cdn.cdpr.app) + sitio oficial
const jobs = [
  ["cyberpunk-2077-cover", "https://cdn-s-press.cdprojektred.com/code-requests/games/cyberpunk-2077.jpg"],
  ["cp-5th-16x9", "https://press.cdn.cdpr.app/media/assets/812/Cyberpunk2077_5thAnniversary_KV_16x9_4k_EN.png"],
  ["cp-5th-1920", "https://press.cdn.cdpr.app/media/assets/812/Cyberpunk2077_5thAnniversary_KV_1920x1080.png"],
  ["cp-afterlife", "https://press.cdn.cdpr.app/media/assets/812/Cyberpunk2077_Afterlife2048x1152_EN.png"],
  ["cp-phl-key", "https://cdn-s-press.cdprojektred.com/code-requests/games/phantom-liberty.jpg"],
  ["cp-phl-art", "https://press.cdn.cdpr.app/media/assets/721/PhL.png"],
  ["cp-ps5-jackie", "https://press.cdn.cdpr.app/media/assets/817/Cyberpunk2077_PS5_Pro_Jackie_CLEAN.png"],
  ["cp-ps5-misty", "https://press.cdn.cdpr.app/media/assets/817/Cyberpunk2077_PS5_Pro_Misty_CLEAN.png"],
  ["cp-ps5-reed", "https://press.cdn.cdpr.app/media/assets/817/Cyberpunk2077_PS5_Pro_Reed_CLEAN.png"],
  ["cp-ps5-smasher", "https://press.cdn.cdpr.app/media/assets/817/Cyberpunk2077_PS5_Pro_Smasher_CLEAN.png"],
  ["cp-ps5-columns", "https://press.cdn.cdpr.app/media/assets/817/Cyberpunk2077_PS5_Pro_Columns_CLEAN.png"],
  ["cp-ps5-cynosure", "https://press.cdn.cdpr.app/media/assets/817/Cyberpunk2077_PS5_Pro_Cynosure_CLEAN.png"],
  ["cp-mac-johnny", "https://press.cdn.cdpr.app/media/assets/808/Cyberpunk2077_Mac_Johnny_CLEAN_EN.png"],
  ["cp-mac-night", "https://press.cdn.cdpr.app/media/assets/808/Cyberpunk2077_Mac_Night_City_at_Day_CLEAN_EN.png"],
  ["cp-mac-japan", "https://press.cdn.cdpr.app/media/assets/808/Cyberpunk2077_Mac_Japantown_Parade_CLEAN_EN.jpeg"],
  ["cp-mac-street", "https://press.cdn.cdpr.app/media/assets/808/Cyberpunk2077_Mac_Street_View_CLEAN_EN.png"],
  ["cp-mac-showdown", "https://press.cdn.cdpr.app/media/assets/808/Cyberpunk2077_Mac_Showdown_CLEAN_EN.jpeg"],
  ["cp-mac-sapphire", "https://press.cdn.cdpr.app/media/assets/808/Cyberpunk2077_Mac_Black_Sapphire_CLEAN_EN.jpeg"],
  ["cp-update-cars", "https://press.cdn.cdpr.app/media/assets/757/CP_2077_2.2_Update_PC_Car_Customization_EN.png"],
  ["cp-home", "https://www.cyberpunk.net/build/images/home12/cover-1920-bd460362.jpg"],
  ["cp-liberty", "https://www.cyberpunk.net/build/images/phantom-liberty/CP77_Phantom_Liberty_KV_16x9_RGB_no_PhL-0a5aaaf8.jpg"],
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
