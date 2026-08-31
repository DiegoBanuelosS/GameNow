import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artDir = join(root, "installer/art");
mkdirSync(artDir, { recursive: true });

const icon = readFileSync(join(root, "assets/vortex-icon.svg"), "utf8");
const pathMatch = icon.match(/<path d="([\s\S]*?)"\/>/);
if (!pathMatch) {
  throw new Error("No se encontró el trazo del vórtice.");
}
const vortexPath = pathMatch[1].replace(/\s+/g, " ");

function vortex({ id, x, y, size, opacity = 1 }) {
  return `
    <svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="639 0 1536 1536" opacity="${opacity}">
      <defs>
        <filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
          <feFlood flood-color="#f2622e" result="fill"/>
          <feComposite in="fill" in2="SourceGraphic" operator="out"/>
        </filter>
      </defs>
      <g filter="url(#${id})" transform="translate(0 1536) scale(0.1 -0.1)" fill="#000000" stroke="none">
        <path d="${vortexPath}"/>
      </g>
    </svg>`;
}

function render(svg, dest, width) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "#000000",
  })
    .render()
    .asPng();
  writeFileSync(dest, png);
  const bmp = dest.replace(/\.png$/i, ".bmp");
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName System.Drawing; $i = [System.Drawing.Image]::FromFile('${dest.replace(/'/g, "''")}'); $i.Save('${bmp.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Bmp); $i.Dispose()`,
    ],
    { stdio: "inherit" },
  );
  console.log(dest);
}

const mark = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" fill="#000000"/>
  ${vortex({ id: "mark", x: 8, y: 8, size: 144 })}
</svg>`;

const back = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="#000000"/>
  <defs>
    <radialGradient id="ember" cx="50%" cy="38%" r="48%">
      <stop offset="0%" stop-color="#f2622e" stop-opacity="0.12"/>
      <stop offset="38%" stop-color="#1a1815" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#ember)"/>
  ${vortex({ id: "back", x: 440, y: -40, size: 720, opacity: 0.11 })}
</svg>`;

render(mark, join(artDir, "vortex-mark.png"), 160);
render(back, join(artDir, "wizard-back.png"), 1600);
