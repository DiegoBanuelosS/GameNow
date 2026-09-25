import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

const jobs = [
  ["f1-2025-2026-season-pack-cover", "image", "https://drop-assets.ea.com/images/2kqSbfawI7SSYCe7Xg30oV/4a8b8edd51bcbcddbbb04158521ed74f/F1_25_2026_Season_Pack_DLC_Key_Art_3840x2160_RGB.jpg"],
  ["nba-2k27-trailer", "video", "https://assets.2k.com/1a6ngf98576c/71yqZEVrUTxW8POXq1KxZE/30f5e5c1dbfe51bc089cf9b391b64e60/NBA2K27_1P-SOCIAL_STD_WEMBY_1920x1080_SKU_V02.mp4"],
  ["the-last-of-us-2-remastered-cover", "image", "https://image.api.playstation.com/vulcan/ap/rnd/202312/0117/315718bce7eed62e3cf3fb02d61b81ff1782d6b6cf850fa4.png"],
  ["how-to-fish-cover", "image", "https://www.datocms-assets.com/66227/1666960459-01_character-3840w-edited.png?auto=format&w=1920"],
  ["arc-raiders-cover", "image", "https://assets.arcraiders.com/static/editions/ArcRaiders_Preorder_Deluxe_Tall_LAUNCH.jpg"],
];

for (const [name, resourceType, url] of jobs) {
  try {
    const result = await cloudinary.uploader.upload(url, {
      public_id: `gamenow/presskit/${name}`,
      resource_type: resourceType,
      overwrite: true,
      timeout: 180000,
    });
    console.log("ok", result.public_id);
  } catch (error) {
    console.log("fail", name, error.message);
  }
}
