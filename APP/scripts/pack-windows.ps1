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
} finally {
  Pop-Location
}

$destDir = Join-Path $root "WWW/public/downloads"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$iscc = @(
  "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) {
  throw "Falta Inno Setup para empaquetar GameNow-Setup.exe"
}
& $iscc (Join-Path $app "installer/GameNow.iss")
Write-Output (Join-Path $destDir "GameNow-Setup.exe")
