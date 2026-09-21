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

/// Descarga el paquete comprimido de la aplicación GameNow desde el servidor/API
Future<List<int>> _downloadAppPayload({
  required void Function(double progress, String status) onProgress,
}) async {
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
            // Fase de descarga: 0.08 a 0.58 del progreso total
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
    } catch (_) {
      // Intentar la siguiente URL candidata
    }
  }
  client.close();

  // Si fallan las descargas por red, intentar con el paquete local si viene empaquetado
  try {
    onProgress(0.12, 'Cargando paquete local de respaldo...');
    final localBundle = await rootBundle.load('assets/payload.zip');
    return localBundle.buffer.asUint8List();
  } catch (_) {
    throw const SocketException(
      'No se pudo descargar la aplicación GameNow. Verifica que el servidor o tu conexión a Internet estén activos.',
    );
  }
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

  final dest = Directory(destinationPath);
  if (dest.existsSync()) {
    dest.deleteSync(recursive: true);
  }
  dest.createSync(recursive: true);

  // 1. Descarga del paquete de la app desde la red / servidor
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
      File(outPath).writeAsBytesSync(file.content as List<int>);
    } else {
      Directory(outPath).createSync(recursive: true);
    }

    if (i % 4 == 0 || i == total - 1) {
      // Fase de extracción: 0.60 a 0.90
      final double progress = 0.60 + ((i + 1) / total) * 0.30;
      onProgress?.call(progress, 'Extrayendo: $name');
      await Future.delayed(const Duration(milliseconds: 8));
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
  await _makeShortcut(
    p.join(
      Platform.environment['APPDATA']!,
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'GameNow.lnk',
    ),
    exe.path,
  );
  if (desktopShortcut) {
    final desktop = Platform.environment['USERPROFILE'];
    if (desktop != null) {
      await _makeShortcut(p.join(desktop, 'Desktop', 'GameNow.lnk'), exe.path);
    }
  }

  onProgress?.call(1.0, '¡Todo listo!');
  await Future.delayed(const Duration(milliseconds: 200));

  return InstallResult(appDir: dest.path, exePath: exe.path);
}

String _ps(String value) => value.replaceAll("'", "''");

Future<void> _makeShortcut(String lnk, String target) async {
  final script =
      '''
\$ws = New-Object -ComObject WScript.Shell
\$s = \$ws.CreateShortcut('${_ps(lnk)}')
\$s.TargetPath = '${_ps(target)}'
\$s.WorkingDirectory = '${_ps(p.dirname(target))}'
\$s.IconLocation = '${_ps(target)},0'
\$s.Save()
''';
  await Process.run('powershell', ['-NoProfile', '-Command', script]);
}

Future<void> _writeUninstall(String appDir, String exePath) async {
  final uninstall = File(p.join(appDir, 'uninstall.cmd'));
  uninstall.writeAsStringSync(
    '''
@echo off
rmdir /s /q "$appDir"
del /q "%USERPROFILE%\\Desktop\\GameNow.lnk" 2>nul
del /q "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\GameNow.lnk" 2>nul
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
  return Process.start(exePath, [], workingDirectory: p.dirname(exePath));
}
