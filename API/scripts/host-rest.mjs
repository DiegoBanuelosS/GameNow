import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(new URL("../.env", import.meta.url));
cloudinary.config({
  cloud_name: process.env.Cloudinary_cloud_name,
  api_key: process.env.Cloudinary_api_key,
  api_secret: process.env.Cloudinary_api_secret,
  secure: true,
});

const jobs = [
  ["f1-shot-1", "https://drop-assets.ea.com/images/5USElVKnotQCS87XVMyvZn/7e2843433eca451f15a51c6010a496e7/F1_25_2026_Season_Pack_DLC_Bundle_Key_Art_3840x2160_RGB.jpg"],
  ["f1-shot-2", "https://drop-assets.ea.com/images/6cgSa3SwnQwFGxzMMqCl1E/4532529cb43e0d8748df008ea163ebd6/F126_AllCar_Grid_16x9_03.png"],
  ["f1-shot-3", "https://drop-assets.ea.com/images/5CajXZOu1rUFrOm8bLKM5Z/11a4d2f5f7052b249b60ef5f07c203aa/F126_Madring_F2_Top3_F_16x9.png"],
  ["f1-shot-4", "https://drop-assets.ea.com/images/3ph0pK64lvTKjRHTQ4mCKP/0082b3d8cc058ff364c9989f647de355/New_Circuit_Madrid_4x3.png"],
  ["fh6-shot-2", "https://cdn.forza.net/strapi-uploads/assets/small_FH_6_Gamescom_Drift_Attack_01_16x9_WM_bab41c7c53.jpg"],
  ["fh6-shot-3", "https://cdn.forza.net/strapi-uploads/assets/small_FH_6_Gamescom_Drift_Attack_02_Direct_Capture_WM_7562b2bdc7.jpg"],
  ["fh6-shot-4", "https://cdn.forza.net/strapi-uploads/assets/small_FH_6_S05_Key_Art_3840x2160_fb8afcde8d.jpg"],
  ["fh6-shot-5", "https://cdn.forza.net/strapi-uploads/assets/small_FH_6_S05_Reward_Cars_BEN_Continental_GT_25_01_16x9_WM_e7122eb511.jpg"],
  ["angler-1", "https://www.datocms-assets.com/66227/1661246106-theangler_image1_website_wallpaper_3840x2160.png"],
  ["angler-2", "https://www.datocms-assets.com/66227/1661246256-theangler_image2_website_wallpaper_3840x2160.png"],
  ["angler-3", "https://www.datocms-assets.com/66227/1661246540-theangler_image3_website_wallpaper_3840x2160.png"],
  ["angler-4", "https://www.datocms-assets.com/66227/1661247069-theangler_image12_website_wallpaper_3840x2160.png"],
  ["007-shot-1", "https://cms.ioi.dk/media/0aml3en0/007firstlight_alt_newrender_keyart_16x9_1920x1080_web.jpg"],
  ["007-shot-2", "https://cms.ioi.dk/media/nqxjdhx5/007fl_titlesequence_keyart_16x9_1920x1080.jpg"],
  ["007-shot-3", "https://cms.ioi.dk/media/f4vfa5i3/007fl_year_one_content_roadmap_16x9_1920x1080-web.jpg"],
  ["mw4-shot-1", "https://i.ytimg.com/vi/jLbst85USN8/maxresdefault.jpg"],
  ["mw4-shot-2", "https://i.ytimg.com/vi/yLFRQaQT0qM/maxresdefault.jpg"],
  ["tlou-shot-1", "https://i.ytimg.com/vi/Ye3st9z6jQY/maxresdefault.jpg"],
  ["tlou-shot-2", "https://i.ytimg.com/vi/kmy8I6xvFIU/maxresdefault.jpg"],
  ["arc-feature", "https://assets.arcraiders.com/static/features/features-keyart.jpg"],
  ["arc-feature-1", "https://assets.arcraiders.com/static/features/feature-1.jpg"],
  ["ark2-cover", "https://i.ytimg.com/vi/JHJ_VxRzT5M/maxresdefault.jpg"],
  ["cp-home", "https://www.cyberpunk.net/build/images/home12/cover-1920-bd460362.jpg"],
  ["cp-liberty", "https://www.cyberpunk.net/build/images/home8/product-phantomliberty-final@2x-21744e1b.jpg"],
];

for (const [name, url] of jobs) {
  try {
    const result = await cloudinary.uploader.upload(url, {
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
