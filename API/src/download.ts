import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const searchFolders = [
  resolve(here, "../../WWW/public/downloads"),
  resolve(process.cwd(), "../WWW/public/downloads"),
  resolve(process.cwd(), "WWW/public/downloads"),
  resolve(process.cwd(), "data/downloads"),
  resolve(here, "../../SETUP/assets"),
  resolve(process.cwd(), "../SETUP/assets"),
];

export async function windowsInstallerPath(): Promise<string> {
  const exeNames = ["GameNow-Setup.exe", "gamenow-setup.exe"];
  for (const folder of searchFolders) {
    for (const name of exeNames) {
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

export async function windowsAppZipPath(): Promise<string> {
  const zipNames = ["GameNow-Windows.zip", "gamenow-windows.zip", "payload.zip"];
  for (const folder of searchFolders) {
    for (const name of zipNames) {
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

export async function windowsPackagePath(): Promise<string> {
  const installer = await windowsInstallerPath();
  if (installer) return installer;
  return windowsAppZipPath();
}
