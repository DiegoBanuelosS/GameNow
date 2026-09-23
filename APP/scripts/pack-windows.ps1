$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "../..")
$app = Join-Path $root "APP"
$setup = Join-Path $root "SETUP"
$flutter = "C:\Users\Diego\flutter\bin\flutter.bat"
if (-not (Test-Path $flutter)) {
  $flutter = "flutter"
}

$iconScript = Join-Path $app "scripts/make-icon.mjs"
if (Test-Path $iconScript) {
  Push-Location (Join-Path $app "scripts")
  try {
    if (-not (Test-Path "node_modules/@resvg/resvg-js")) {
      npm install --silent @resvg/resvg-js
    }
    node make-icon.mjs
  } finally {
    Pop-Location
  }
}

Push-Location $app
try {
  & $flutter build windows --release
  if ($LASTEXITCODE -ne 0) {
    throw "Falló la compilación de APP en modo release."
  }
} finally {
  Pop-Location
}

$release = Join-Path $app "build/windows/x64/runner/Release"
$payload = Join-Path $setup "assets/payload.zip"
if (Test-Path $payload) {
  Remove-Item $payload
}
$stage = Join-Path $env:TEMP "gamenow-payload"
if (Test-Path $stage) {
  Remove-Item -Recurse -Force $stage
}
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -Recurse -Force (Join-Path $release "*") $stage
Get-ChildItem $stage -Filter *.pdb -ErrorAction SilentlyContinue | Remove-Item -Force
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $payload
Remove-Item -Recurse -Force $stage

Push-Location $setup
try {
  & $flutter build windows --release
  if ($LASTEXITCODE -ne 0) {
    throw "Falló la compilación de SETUP en modo release."
  }
} finally {
  Pop-Location
}

$destDir = Join-Path $root "WWW/public/downloads"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$destExe = Join-Path $destDir "GameNow-Setup.exe"

# 1. Comprimir los archivos del instalador con interfaz propia (SETUP)
$setupRelease = Join-Path $setup "build/windows/x64/runner/Release"
$setupZip = Join-Path $env:TEMP "gamenow-setup-bundle.zip"
if (Test-Path $setupZip) { Remove-Item -Force $setupZip }

$setupStage = Join-Path $env:TEMP "gamenow-setup-stage"
if (Test-Path $setupStage) { Remove-Item -Recurse -Force $setupStage }
New-Item -ItemType Directory -Force -Path $setupStage | Out-Null
Copy-Item -Recurse -Force (Join-Path $setupRelease "*") $setupStage
Get-ChildItem $setupStage -Filter *.pdb -ErrorAction SilentlyContinue | Remove-Item -Force
Compress-Archive -Path (Join-Path $setupStage "*") -DestinationPath $setupZip
Remove-Item -Recurse -Force $setupStage

# 2. Compilar ejecutable autónomo sin Inno Setup usando csc de .NET
$csc = @(
  "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $csc) {
  throw "No se encontró csc.exe para compilar el lanzador del instalador."
}

$bootstrapperCs = Join-Path $env:TEMP "GameNowBootstrapper.cs"
$csCode = @"
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

namespace GameNow.Bootstrapper {
    internal static class Program {
        [STAThread]
        private static int Main(string[] args) {
            try {
                string tempDir = Path.Combine(Path.GetTempPath(), "GameNowSetup_" + Guid.NewGuid().ToString("N").Substring(0, 8));
                Directory.CreateDirectory(tempDir);

                string targetExe = Path.Combine(tempDir, "gamenow_setup.exe");

                var asm = Assembly.GetExecutingAssembly();
                using (var stream = asm.GetManifestResourceStream("setup.zip")) {
                    if (stream != null) {
                        string zipTemp = Path.Combine(tempDir, "bundle.zip");
                        using (var fs = new FileStream(zipTemp, FileMode.Create, FileAccess.Write)) {
                            stream.CopyTo(fs);
                        }
                        ZipFile.ExtractToDirectory(zipTemp, tempDir);
                        try { File.Delete(zipTemp); } catch {}
                    }
                }

                if (!File.Exists(targetExe)) {
                    MessageBox.Show("No se encontró el ejecutable del instalador.", "GameNow Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 1;
                }

                var psi = new ProcessStartInfo {
                    FileName = targetExe,
                    WorkingDirectory = tempDir,
                    Arguments = string.Join(" ", args)
                };
                Process.Start(psi);
                return 0;
            } catch (Exception ex) {
                MessageBox.Show("Error al iniciar el instalador de GameNow: " + ex.Message, "GameNow Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }
    }
}
"@
Set-Content -Path $bootstrapperCs -Value $csCode -Encoding UTF8

$appIcon = Join-Path $app "windows/runner/resources/app_icon.ico"
$cscArgs = @(
  "/target:winexe",
  "/optimize+",
  "/platform:x64",
  "/reference:System.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll,System.Windows.Forms.dll",
  "/resource:$setupZip,setup.zip",
  "/out:$destExe"
)
if (Test-Path $appIcon) {
  $cscArgs += "/win32icon:$appIcon"
}
$cscArgs += $bootstrapperCs

& $csc $cscArgs
if ($LASTEXITCODE -ne 0) {
  throw "Falló la compilación de GameNow-Setup.exe"
}

Remove-Item -Force $bootstrapperCs -ErrorAction SilentlyContinue
Remove-Item -Force $setupZip -ErrorAction SilentlyContinue

Write-Output "Instalador autónomo generado con éxito en: $destExe"
