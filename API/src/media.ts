import { openSync, readSync, closeSync } from "node:fs";
import { resolve } from "node:path";
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
    crop: "limit",
    gravity: "center",
    quality: "auto:best",
    widths: [640, 960, 1280, 1600],
    sizes: "(min-width: 1100px) 36vw, 92vw",
  },
  event: {
    crop: "limit",
    gravity: "center",
    quality: "auto:good",
    widths: [400, 720, 1080],
    sizes: "(min-width: 1100px) 28vw, 90vw",
  },
  offer: {
    crop: "limit",
    gravity: "center",
    quality: "auto:good",
    widths: [280, 480, 720],
    sizes: "(min-width: 1100px) 12vw, 30vw",
  },
  hero: {
    crop: "limit",
    gravity: "center",
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
  const libraryHd = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
  const libraryStd = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
  const headerFallback = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
  return {
    src: libraryHd,
    srcSet: `${libraryStd} 600w, ${libraryHd} 1200w`,
    sizes: "(min-width: 1200px) 300px, 220px",
    fallback: headerFallback,
  };
}

const audioSeen = new Map<string, boolean>();

/** El archivo local solo cuenta si trae pista de audio. Muchos WebM del catálogo van en silencio. */
export function localFileHasAudio(publicPath: string) {
  const cached = audioSeen.get(publicPath);
  if (cached !== undefined) {
    return cached;
  }
  const file = resolve(process.cwd(), "../WWW/public", publicPath.replace(/^\//, ""));
  let has = false;
  try {
    const fd = openSync(file, "r");
    try {
      const chunk = Buffer.alloc(2 * 1024 * 1024);
      const read = readSync(fd, chunk, 0, chunk.length, 0);
      const head = chunk.subarray(0, read).toString("latin1");
      has =
        head.includes("A_OPUS") ||
        head.includes("OpusHead") ||
        head.includes("A_VORBIS") ||
        head.includes("mp4a") ||
        head.includes("soun");
    } finally {
      closeSync(fd);
    }
  } catch {
    has = false;
  }
  audioSeen.set(publicPath, has);
  return has;
}

export function videoSources(asset?: CloudAsset | null) {
  const sources: { src: string; type: string }[] = [];
  if (asset?.hosted && asset.publicId) {
    sources.push({ src: videoCachePath(asset.publicId), type: "video/mp4" });
  }
  return sources;
}

export function deliverVideo(asset?: CloudAsset | null) {
  return videoSources(asset)[0]?.src || "";
}
