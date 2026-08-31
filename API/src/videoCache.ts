import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { videoOriginUrl } from "./media.js";

const dir = resolve(process.cwd(), "cache/videos");
const inflight = new Map<string, Promise<string>>();

function fileFor(publicId: string) {
  const hash = createHash("sha1").update(publicId).digest("hex");
  return resolve(dir, `${hash}.mp4`);
}

async function localPublicFile(publicId: string) {
  try {
    const raw = await readFile(resolve(process.cwd(), "data/catalog.json"), "utf8");
    const rows = JSON.parse(raw) as { trailer?: { publicId?: string; local?: string } }[];
    const local = rows.find((row) => row.trailer?.publicId === publicId)?.trailer?.local;
    if (!local) {
      return "";
    }
    return resolve(process.cwd(), "../WWW/public", local.replace(/^\//, ""));
  } catch {
    return "";
  }
}

export function videoContentType(file: string) {
  return extname(file).toLowerCase() === ".webm" ? "video/webm" : "video/mp4";
}

export async function cachedVideoPath(publicId: string) {
  if (!publicId.startsWith("gamenow/")) {
    throw new Error("publicId no permitido");
  }

  const local = await localPublicFile(publicId);
  if (local) {
    try {
      const info = await stat(local);
      if (info.size > 0) {
        return local;
      }
    } catch {
      /* Cloudinary next */
    }
  }

  const file = fileFor(publicId);
  try {
    const info = await stat(file);
    if (info.size > 0) {
      return file;
    }
  } catch {
    /* miss */
  }

  const pending = inflight.get(publicId);
  if (pending) {
    return pending;
  }

  const job = (async () => {
    await mkdir(dir, { recursive: true });
    const response = await fetch(videoOriginUrl(publicId));
    if (!response.ok) {
      throw new Error(`Cloudinary video ${response.status}`);
    }
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    return file;
  })();

  inflight.set(publicId, job);
  try {
    return await job;
  } finally {
    inflight.delete(publicId);
  }
}
