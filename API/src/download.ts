import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const names = ["GameNow-Setup.exe", "GameNow-Windows.zip", "gamenow-windows.zip"];
const here = dirname(fileURLToPath(import.meta.url));

export async function windowsPackagePath() {
  const folders = [
    resolve(here, "../../WWW/public/downloads"),
    resolve(process.cwd(), "../WWW/public/downloads"),
    resolve(process.cwd(), "WWW/public/downloads"),
    resolve(process.cwd(), "data/downloads"),
  ];
  for (const folder of folders) {
    for (const name of names) {
      const file = resolve(folder, name);
      try {
        await access(file);
        return file;
      } catch {
        /* next */
      }
    }
  }
  return "";
}
