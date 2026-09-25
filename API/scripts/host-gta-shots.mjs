import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

const root = process.env.TEMP + "/gta-shots/Places";
const shots = [
  ["gta-vi-vice", `${root}/Vice City/Vice_City_01.jpg`],
  ["gta-vi-keys", `${root}/Leonida Keys/Leonida_Keys_01.jpg`],
  ["gta-vi-port", `${root}/Port Gellhorn/Port_Gellhorn_01.jpg`],
  ["gta-vi-grass", `${root}/Grassrivers/Grassrivers_01.jpg`],
  ["gta-vi-kalaga", `${root}/Mount Kalaga National Park/Mount_Kalaga_National_Park_01.jpg`],
  ["gta-vi-ambrosia", `${root}/Ambrosia/Ambrosia_01.jpg`],
];

for (const [name, file] of shots) {
  try {
    const result = await cloudinary.uploader.upload(file, {
      public_id: `gamenow/presskit/${name}`,
      resource_type: "image",
      overwrite: true,
      timeout: 120000,
    });
    console.log("ok", result.public_id);
  } catch (error) {
    console.log("fail", name, error?.message || error);
  }
}
