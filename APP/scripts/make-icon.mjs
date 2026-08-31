import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "assets/vortex-icon.svg"));
const sizes = [16, 32, 48, 256];

function pngAt(size) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "#000000",
  })
    .render()
    .asPng();
}

function toIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (let i = 0; i < pngs.length; i += 1) {
    const png = pngs[i];
    const dim = sizes[i] >= 256 ? 0 : sizes[i];
    const entry = Buffer.alloc(16);
    entry[0] = dim;
    entry[1] = dim;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...pngs]);
}

const pngs = sizes.map(pngAt);
const dest = join(root, "windows/runner/resources/app_icon.ico");
writeFileSync(dest, toIco(pngs));
writeFileSync(join(root, "assets/vortex-256.png"), pngs[3]);
console.log(dest);
