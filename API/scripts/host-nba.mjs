import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

/** Press kit 2K Newsroom — brand artwork + box artwork (NBA 2K27) */
const jobs = [
  // Box / ediciones
  ["nba-2k27-standard", "https://cdn.prgloo.com/media/download/af785268f5db4bd8aed73a800ef433d7"],
  ["nba-2k27-deluxe", "https://cdn.prgloo.com/media/download/5d2c2a8ae0464aeda885f5f9978f920a"],
  ["nba-2k27-ultra", "https://cdn.prgloo.com/media/download/f0891cd8f5c240f7ada01d52904a5016"],
  ["nba-2k27-cover-reveal", "https://cdn.prgloo.com/media/download/8aeafdf55e1a4be29af67b6512ceaa57"],
  // Brand key art (galería)
  ["nba-2k27-season-1", "https://cdn.prgloo.com/media/download/447ad2885dc7433699c06f016d22fd4c"],
  ["nba-2k27-mycareer", "https://cdn.prgloo.com/media/download/0cddbd461e9c49d8bea73f8bafa186f6"],
  ["nba-2k27-the-w", "https://cdn.prgloo.com/media/download/aa4012de26d44bd08886f99ba4b0c487"],
  ["nba-2k27-myplayer-builder", "https://cdn.prgloo.com/media/download/247aa4e854f841468a04add9b0873a75"],
  ["nba-2k27-mynba", "https://cdn.prgloo.com/media/download/38e0efe4015644c983fba1d3785e5cbd"],
  ["nba-2k27-myteam", "https://cdn.prgloo.com/media/download/10307e52bcca45bd96e87433d1df57e3"],
  ["nba-2k27-2k-hq", "https://cdn.prgloo.com/media/download/263c87993f4f4f5f9a335485d4487b72"],
  ["nba-2k27-the-city", "https://cdn.prgloo.com/media/download/aefd968061664f20ac4332dcd50a6df0"],
  ["nba-2k27-gameplay-key", "https://cdn.prgloo.com/media/download/48c5d0b9bed94a779353a9b06feccbe4"],
  ["nba-2k27-launch-beats", "https://cdn.prgloo.com/media/download/e55a6c6c72d14c14996a82bc5a78ab9c"],
  ["nba-2k27-gameplay-trailer-key", "https://cdn.prgloo.com/media/download/3c3392079f99485b86f403933b4edc0e"],
  ["nba-2k27-preseason", "https://cdn.prgloo.com/media/download/a11a471103d14f19a43e78e6f0aec282"],
  ["nba-2k27-roadmap", "https://cdn.prgloo.com/media/download/22f255fd7a27499cb91e3caf1a36cd57"],
  ["nba-2k27-cover-reveal-brand", "https://cdn.prgloo.com/media/download/695f0daef4444c83beef30d57fdfac2e"],
];

for (const [name, url] of jobs) {
  try {
    const result = await cloudinary.uploader.upload(url, {
      public_id: `gamenow/presskit/${name}`,
      resource_type: "image",
      overwrite: true,
      timeout: 180000,
    });
    console.log("ok", result.public_id, `${result.width}x${result.height}`);
  } catch (error) {
    console.log("fail", name, error?.message || error);
  }
}
