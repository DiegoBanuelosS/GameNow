import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

const result = await cloudinary.uploader.upload(
  "https://imgs.callofduty.com/content/dam/atvi/callofduty/cod-touchui/mw4/meta/MW4_LP_Meta.webp",
  {
    public_id: "gamenow/presskit/mw4-cover",
    resource_type: "image",
    overwrite: true,
    timeout: 120000,
  },
);
console.log("ok", result.public_id, result.bytes);
