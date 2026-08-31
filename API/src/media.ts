import { config } from "./config.js";

export type CloudAsset = {
  publicId: string;
  resourceType: "image" | "video";
  local?: string;
  hosted?: boolean;
};

type ImageRole = "ad" | "event" | "offer" | "hero" | "logo" | "auth";

const imagePreset: Record<
  ImageRole,
  { crop: string; gravity: string; quality: string; widths: number[]; sizes: string }
> = {
  ad: {
    crop: "fill",
    gravity: "auto",
    quality: "auto:best",
    widths: [640, 960, 1280, 1600],
    sizes: "(min-width: 1100px) 36vw, 92vw",
  },
  event: {
    crop: "fill",
    gravity: "auto",
    quality: "auto:good",
    widths: [400, 720, 1080],
    sizes: "(min-width: 1100px) 28vw, 90vw",
  },
  offer: {
    crop: "fill",
    gravity: "auto",
    quality: "auto:good",
    widths: [280, 480, 720],
    sizes: "(min-width: 1100px) 12vw, 30vw",
  },
  hero: {
    crop: "fill",
    gravity: "auto",
    quality: "auto:best",
    widths: [720, 1080, 1440],
    sizes: "(min-width: 800px) 720px, 92vw",
  },
  logo: {
    crop: "pad",
    gravity: "center",
    quality: "auto:good",
    widths: [64, 96, 128],
    sizes: "32px",
  },
  auth: {
    crop: "fill",
    gravity: "auto",
    quality: "auto:best",
    widths: [720, 1080, 1600],
    sizes: "(min-width: 900px) 42vw, 100vw",
  },
};

function cloud() {
  return config.cloudinary.cloudName;
}

export function imageUrl(publicId: string, role: ImageRole, width?: number) {
  const preset = imagePreset[role];
  const w = width ?? preset.widths[preset.widths.length - 1];
  return `https://res.cloudinary.com/${cloud()}/image/upload/f_auto,q_${preset.quality},dpr_auto,c_${preset.crop},g_${preset.gravity},w_${w}/${publicId}`;
}

export function imageSrcSet(publicId: string, role: ImageRole) {
  return imagePreset[role].widths
    .map((width) => `${imageUrl(publicId, role, width)} ${width}w`)
    .join(", ");
}

export function imageSizes(role: ImageRole) {
  return imagePreset[role].sizes;
}

export function videoOriginUrl(publicId: string) {
  return `https://res.cloudinary.com/${cloud()}/video/upload/f_mp4,vc_h264,q_auto:eco,c_limit,w_960,br_900k/${publicId}.mp4`;
}

export function videoCachePath(publicId: string) {
  return `/api/media/video?id=${encodeURIComponent(publicId)}`;
}

export function deliverImage(asset?: CloudAsset | null, role: ImageRole = "offer") {
  if (!asset) {
    return { src: "", srcSet: "", sizes: imageSizes(role) };
  }
  if (asset.hosted && asset.publicId) {
    return {
      src: imageUrl(asset.publicId, role),
      srcSet: imageSrcSet(asset.publicId, role),
      sizes: imageSizes(role),
    };
  }
  return { src: asset.local || "", srcSet: "", sizes: imageSizes(role) };
}

export function steamCover(appId: string) {
  const origin = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
  const encoded = encodeURIComponent(origin);
  const widths = [160, 320, 460];
  return {
    src: `https://res.cloudinary.com/${cloud()}/image/fetch/f_auto,q_auto:good,c_fill,g_auto,w_320/${encoded}`,
    srcSet: widths
      .map(
        (width) =>
          `https://res.cloudinary.com/${cloud()}/image/fetch/f_auto,q_auto:good,c_fill,g_auto,w_${width}/${encoded} ${width}w`,
      )
      .join(", "),
    sizes: "120px",
    fallback: origin,
  };
}

export function videoSources(asset?: CloudAsset | null) {
  const sources: { src: string; type: string }[] = [];
  if (asset?.local) {
    sources.push({
      src: asset.local,
      type: asset.local.endsWith(".webm") ? "video/webm" : "video/mp4",
    });
  }
  if (asset?.hosted && asset.publicId) {
    sources.push({ src: videoCachePath(asset.publicId), type: "video/mp4" });
  }
  return sources;
}

export function deliverVideo(asset?: CloudAsset | null) {
  return videoSources(asset)[0]?.src || "";
}
