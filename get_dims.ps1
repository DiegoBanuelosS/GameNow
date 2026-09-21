$html = @'
<!DOCTYPE html>
<html>
<head>
<style>
html, body { margin: 0; padding: 0; background: #000; }
img { display: block; }
</style>
</head>
<body>
<img id="img" src="header.webp">
<script>
window.onload = function() {
    var img = document.getElementById('img');
    document.title = 'DIM:' + img.naturalWidth + 'x' + img.naturalHeight;
};
</script>
</body>
</html>
'@

$dir = "c:\Users\Diego\OneDrive\Documentos\GitHub\GameNow\SETUP\assets"
$htmlFile = Join-Path $dir "dims.html"
[System.IO.File]::WriteAllText($htmlFile, $html)

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
# Let's also convert header.webp to full natural size header_original.png
$outFull = Join-Path $dir "header_original.png"

$args = @(
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1920,1080",
    "--screenshot=$outFull",
    "file:///$($htmlFile.Replace('\', '/'))"
)

Start-Process -FilePath $edgePath -ArgumentList $args -PassThru -Wait
Remove-Item $htmlFile -ErrorAction SilentlyContinue

Write-Host "header_original.png size: $((Get-Item $outFull).Length)"
