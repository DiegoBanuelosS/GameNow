import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

const origin = "https://www.rockstargames.com";
const jobs = [
  ["gta-vi-cover", "image", `${origin}/VI/_next/static/media/GTAVI_FOB_StandardEdition_Desktop.09clbpu8-nv8i.jpg`],
  ["gta-vi-cover-art", "video", "https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_Official_Cover_Art_Landscape/GTAVI_Official_Cover_Art_Landscape.mp4"],
  ["gta-vi-jason", "video", `${origin}/VI/_next/static/media/Jason_Duval_Video_Clip.10.gc09c9y-j9.mp4`],
  ["gta-vi-lucia", "video", `${origin}/VI/_next/static/media/Lucia_Caminos_Video_Clip.0g8.3fx84ixw..mp4`],
  ["gta-vi-cal", "video", `${origin}/VI/_next/static/media/Cal_Hampton_Video_Clip.13-520tpb1vbq.mp4`],
  ["gta-vi-boobie", "video", `${origin}/VI/_next/static/media/Boobie_Ike_Video_Clip.0yf7eprhr68rj.mp4`],
  ["gta-vi-drequan", "video", `${origin}/VI/_next/static/media/DreQuan_Priest_Video_Clip.0g~ify.ccqpkj.mp4`],
  ["gta-vi-dimez", "video", `${origin}/VI/_next/static/media/Real_Dimez_Video_Clip.0.cgr_26mspvm.mp4`],
  ["gta-vi-raul", "video", `${origin}/VI/_next/static/media/Raul_Bautista_Video_Clip.0vg4g-gyqaksg.mp4`],
  ["gta-vi-brian", "video", `${origin}/VI/_next/static/media/Brian_Heder_Video_Clip.0yy.ets6sso8~.mp4`],
];

for (const [name, resourceType, url] of jobs) {
  try {
    const result = await cloudinary.uploader.upload(url, {
      public_id: `gamenow/presskit/${name}`,
      resource_type: resourceType,
      overwrite: true,
      timeout: 300000,
    });
    console.log("ok", result.public_id, result.bytes);
  } catch (error) {
    console.log("fail", name, error?.message || error);
  }
}
