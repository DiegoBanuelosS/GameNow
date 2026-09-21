import { resolve } from "node:path";

try {
  process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch (_) {}

export const config = {
  port: Number(process.env.PORT || 8787),
  wwwOrigin: process.env.WWW_ORIGIN || "http://127.0.0.1:5173",
  mongoUri: process.env.MONGODB_URI?.trim() || "",
  mongoDb: process.env.MONGODB_DB || "gamenow",
  cloudinary: {
    cloudName: process.env.Cloudinary_cloud_name || "",
    apiKey: process.env.Cloudinary_api_key || "",
    apiSecret: process.env.Cloudinary_api_secret || "",
  },
};

export function requireCloudinary() {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Faltan Cloudinary_cloud_name, Cloudinary_api_key o Cloudinary_api_secret en API/.env");
  }
  return { cloudName, apiKey, apiSecret };
}
