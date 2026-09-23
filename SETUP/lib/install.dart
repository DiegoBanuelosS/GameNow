import 'dart:io';
import 'dart:typed_data';

import 'package:archive/archive_io.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;

class InstallResult {
  const InstallResult({required this.appDir, required this.exePath});

  final String appDir;
  final String exePath;
}

String installDir() {
  final home = Platform.environment['LOCALAPPDATA'];
  if (home == null || home.isEmpty) {
    throw const FileSystemException('No encontramos tu carpeta de usuario.');
  }
  return p.join(home, 'GameNow');
}

/// Descarga o carga el paquete comprimido de la aplicación GameNow
Future<List<int>> _downloadAppPayload({
  required void Function(double progress, String status) onProgress,
}) async {
  // 1. Intentar cargar primero el paquete local empaquetado con el instalador
  onProgress(0.08, 'Cargando componentes de GameNow...');

  final localCandidates = [
    p.join(p.dirname(Platform.resolvedExecutable), 'data', 'flutter_assets', 'assets', 'payload.zip'),
    p.join(Directory.current.path, 'assets', 'payload.zip'),
    p.join(Directory.current.path, 'data', 'flutter_assets', 'assets', 'payload.zip'),
  ];
  for (final candidate in localCandidates) {
    final f = File(candidate);
    if (f.existsSync()) {
      try {
        final bytes = f.readAsBytesSync();
        if (bytes.isNotEmpty) {
          onProgress(0.50, 'Paquete local cargado.');
          return bytes;
        }
      } catch (_) {}
    }
  }

  try {
    final localBundle = await rootBundle.load('assets/payload.zip');
    final bytes = localBundle.buffer.asUint8List(
      localBundle.offsetInBytes,
      localBundle.lengthInBytes,
    );
    if (bytes.isNotEmpty) {
      onProgress(0.50, 'Paquete de instalación cargado.');
      return bytes;
    }
  } catch (_) {}

  // 2. Si no viene en local, intentar con el servidor de descargas
  final candidateUrls = [
    if (Platform.environment['GAMENOW_APP_URL'] != null)
      Platform.environment['GAMENOW_APP_URL']!,
    'http://127.0.0.1:8787/api/download/app',
    'http://localhost:8787/api/download/app',
    'http://127.0.0.1:8787/api/download/windows?target=app',
    'http://localhost:8787/api/download/windows?target=app',
    'http://127.0.0.1:5173/downloads/GameNow-Windows.zip',
    'http://localhost:5173/downloads/GameNow-Windows.zip',
  ];

  final client = HttpClient();
  client.connectionTimeout = const Duration(seconds: 4);

  for (final url in candidateUrls) {
    try {
      onProgress(0.06, 'Conectando con el servidor de descargas...');
      final uri = Uri.parse(url);
      final request = await client.getUrl(uri);
      final response = await request.close();

      if (response.statusCode == 200) {
        final totalBytes = response.contentLength;
        final builder = BytesBuilder(copy: false);
        int downloaded = 0;

        await for (final chunk in response) {
          builder.add(chunk);
          downloaded += chunk.length;

          if (totalBytes > 0) {
            final double dlFraction = (downloaded / totalBytes).clamp(0.0, 1.0);
            final double overall = 0.08 + (dlFraction * 0.50);
            final String mbDown = (downloaded / (1024 * 1024)).toStringAsFixed(1);
            final String mbTotal = (totalBytes / (1024 * 1024)).toStringAsFixed(1);
            onProgress(overall, 'Descargando GameNow ($mbDown MB / $mbTotal MB)...');
          } else {
            final String mbDown = (downloaded / (1024 * 1024)).toStringAsFixed(1);
            onProgress(0.30, 'Descargando GameNow ($mbDown MB)...');
          }
        }
        client.close();
        final bytes = builder.takeBytes();
        if (bytes.isNotEmpty) {
          return bytes;
        }
      }
    } catch (_) {}
  }
  client.close();

  throw const SocketException(
    'No se pudo encontrar el paquete de instalación de GameNow. Verifica la conexión o vuelve a empaquetar.',
  );
}

Future<InstallResult> installGameNow({
  String? targetDir,
  required bool desktopShortcut,
  void Function(double progress, String status)? onProgress,
}) async {
  final destinationPath = targetDir != null && targetDir.trim().isNotEmpty
      ? targetDir.trim()
      : installDir();

  onProgress?.call(0.03, 'Preparando carpetas de instalación...');
  await Future.delayed(const Duration(milliseconds: 100));

  // Cerrar GameNow si ya está ejecutándose para evitar bloqueos
  try {
    await Process.run('taskkill', ['/F', '/IM', 'gamenow.exe']);
  } catch (_) {}

  final dest = Directory(destinationPath);
  if (dest.existsSync()) {
    try {
      dest.deleteSync(recursive: true);
    } catch (_) {}
  }
  dest.createSync(recursive: true);

  // 1. Descarga u obtención del paquete
  final bytes = await _downloadAppPayload(
    onProgress: (prog, text) => onProgress?.call(prog, text),
  );

  onProgress?.call(0.60, 'Extrayendo componentes de GameNow...');
  await Future.delayed(const Duration(milliseconds: 100));

  final archive = ZipDecoder().decodeBytes(bytes);
  if (archive.isEmpty) {
    throw const FormatException('El paquete descargado de GameNow está vacío.');
  }

  final total = archive.length;
  for (int i = 0; i < total; i++) {
    final file = archive[i];
    final name = file.name.replaceAll('\\', '/');
    if (name.isEmpty || name.contains('..')) {
      continue;
    }
    final outPath = p.join(dest.path, name);
    if (file.isFile) {
      File(outPath).parent.createSync(recursive: true);
      final dynamic content = file.content;
      if (content is List<int>) {
        File(outPath).writeAsBytesSync(content);
      } else {
        File(outPath).writeAsBytesSync((content as dynamic).toList() as List<int>);
      }
    } else {
      Directory(outPath).createSync(recursive: true);
    }

    if (i % 4 == 0 || i == total - 1) {
      final double progress = 0.60 + ((i + 1) / total) * 0.30;
      onProgress?.call(progress, 'Extrayendo: $name');
      await Future.delayed(const Duration(milliseconds: 6));
    }
  }

  onProgress?.call(0.90, 'Verificando ejecutables del sistema...');
  await Future.delayed(const Duration(milliseconds: 150));

  final exe = File(p.join(dest.path, 'gamenow.exe'));
  if (!exe.existsSync()) {
    throw const FileSystemException('No encontramos gamenow.exe en el paquete.');
  }

  onProgress?.call(0.94, 'Configurando desinstalador...');
  await _writeUninstall(dest.path, exe.path);

  onProgress?.call(0.97, 'Creando accesos directos...');
  await _makeShortcutByFolder('Programs', 'GameNow.lnk', exe.path);
  if (desktopShortcut) {
    await _makeShortcutByFolder('Desktop', 'GameNow.lnk', exe.path);
  }

  onProgress?.call(1.0, '¡Todo listo!');
  await Future.delayed(const Duration(milliseconds: 200));

  return InstallResult(appDir: dest.path, exePath: exe.path);
}

String _ps(String value) => value.replaceAll("'", "''");

Future<void> _makeShortcutByFolder(String specialFolder, String linkName, String target) async {
  final script = '''
\$dir = [Environment]::GetFolderPath([Environment+SpecialFolder]::$specialFolder)
if (\$dir -and (Test-Path \$dir)) {
  \$lnk = Join-Path \$dir '${_ps(linkName)}'
  \$ws = New-Object -ComObject WScript.Shell
  \$s = \$ws.CreateShortcut(\$lnk)
  \$s.TargetPath = '${_ps(target)}'
  \$s.WorkingDirectory = '${_ps(p.dirname(target))}'
  \$s.IconLocation = '${_ps(target)},0'
  \$s.Save()
}
''';
  await Process.run('powershell', ['-NoProfile', '-Command', script]);
}

Future<void> _writeUninstall(String appDir, String exePath) async {
  final uninstall = File(p.join(appDir, 'uninstall.cmd'));
  uninstall.writeAsStringSync(
    '''
@echo off
taskkill /F /IM gamenow.exe 2>nul
rmdir /s /q "$appDir"
powershell -NoProfile -Command "\$d = [Environment]::GetFolderPath('Desktop'); if (\$d) { Remove-Item (Join-Path \$d 'GameNow.lnk') -Force -ErrorAction SilentlyContinue }; \$p = [Environment]::GetFolderPath('Programs'); if (\$p) { Remove-Item (Join-Path \$p 'GameNow.lnk') -Force -ErrorAction SilentlyContinue }"
reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameNow" /f >nul 2>nul
''',
  );

  final script =
      '''
New-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameNow' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameNow' -Name DisplayName -Value 'GameNow'
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameNow' -Name DisplayIcon -Value '${_ps(exePath)}'
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameNow' -Name UninstallString -Value '${_ps(p.join(appDir, 'uninstall.cmd'))}'
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameNow' -Name Publisher -Value 'GameNow'
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameNow' -Name NoModify -Value 1 -Type DWord
''';
  await Process.run('powershell', ['-NoProfile', '-Command', script]);
}

Future<void> openGameNow(String exePath) {
  return Process.start(
    exePath,
    [],
    workingDirectory: p.dirname(exePath),
    mode: ProcessStartMode.detached,
  );
}
