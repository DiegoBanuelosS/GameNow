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

class ExistingInstall {
  const ExistingInstall({required this.appDir, required this.exePath});

  final String appDir;
  final String exePath;
}

ExistingInstall? _existingIn(String dir) {
  final exe = File(p.join(dir, 'gamenow.exe'));
  if (exe.existsSync()) {
    return ExistingInstall(appDir: dir, exePath: exe.path);
  }
  return null;
}

/// Instalación en la carpeta por defecto, sin consultar el registro.
ExistingInstall? findExistingInstallSync() {
  try {
    final home = Platform.environment['LOCALAPPDATA'];
    if (home == null || home.isEmpty) return null;
    return _existingIn(p.join(home, 'Programs', 'GameNow')) ??
        _existingIn(p.join(home, 'GameNow'));
  } catch (_) {}
  return null;
}

/// Busca una instalación previa en el registro o en la carpeta por defecto.
Future<ExistingInstall?> findExistingInstall() async {
  final fromRegistry = await _installDirFromRegistry();
  if (fromRegistry != null) {
    final exe = File(p.join(fromRegistry, 'gamenow.exe'));
    if (exe.existsSync()) {
      return ExistingInstall(appDir: fromRegistry, exePath: exe.path);
    }
  }
  return findExistingInstallSync();
}

Future<String?> _installDirFromRegistry() async {
  const script = r'''
$k = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GameNow' -ErrorAction SilentlyContinue
if (-not $k) { exit 0 }
if ($k.InstallLocation) { Write-Output $k.InstallLocation.TrimEnd('\') }
elseif ($k.UninstallString) { Write-Output (Split-Path -Parent $k.UninstallString) }
''';
  try {
    final result = await Process.run('powershell', ['-NoProfile', '-Command', script]);
    final raw = (result.stdout as String).trim();
    if (raw.isEmpty) return null;
    return raw.split(RegExp(r'\r?\n')).last.trim();
  } catch (_) {
    return null;
  }
}

String installDir() {
  final home = Platform.environment['LOCALAPPDATA'];
  if (home == null || home.isEmpty) {
    throw const FileSystemException('No encontramos tu carpeta de usuario.');
  }
  return p.join(home, 'Programs', 'GameNow');
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

  await _registerInstalledApp(appDir, exePath);
}

Future<void> _registerInstalledApp(String appDir, String exePath) async {
  const key = r'HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\GameNow';
  final sizeKb = _folderSizeKb(appDir).clamp(1, 0x7fffffff);
  final installDate = DateTime.now().toIso8601String().substring(0, 10).replaceAll('-', '');

  Future<void> add(String name, String type, String value) async {
    final result = await Process.run('reg', [
      'add',
      key,
      '/v',
      name,
      '/t',
      type,
      '/d',
      value,
      '/f',
    ]);
    if (result.exitCode != 0) {
      throw FileSystemException(
        'No se pudo registrar GameNow en Aplicaciones instaladas.',
        name,
        OSError('${result.stderr}'.trim(), result.exitCode),
      );
    }
  }

  await add('DisplayName', 'REG_SZ', 'GameNow');
  await add('DisplayVersion', 'REG_SZ', '1.0.0');
  await add('Publisher', 'REG_SZ', 'GameNow');
  await add('InstallLocation', 'REG_SZ', appDir);
  final setupExe = await copySetupRuntime(p.join(appDir, 'uninstall'));
  final uninstallLaunch = '"$setupExe" --uninstall';

  await add('DisplayIcon', 'REG_SZ', '$exePath,0');
  await add('UninstallString', 'REG_SZ', uninstallLaunch);
  await add('QuietUninstallString', 'REG_SZ', uninstallLaunch);
  await add('InstallDate', 'REG_SZ', installDate);
  await add('EstimatedSize', 'REG_DWORD', '$sizeKb');
  await add('NoModify', 'REG_DWORD', '1');
  await add('NoRepair', 'REG_DWORD', '1');
  await add('Language', 'REG_DWORD', '1034');
}

bool launchedForUninstall(List<String> args) {
  return args.any((arg) {
    final value = arg.toLowerCase();
    return value == '--uninstall' || value == '/uninstall' || value == '-uninstall';
  });
}

bool executableInside(String appDir) {
  final exe = p.normalize(Platform.resolvedExecutable).toLowerCase();
  final root = p.normalize(appDir).toLowerCase();
  return exe == root || exe.startsWith('$root${Platform.pathSeparator}');
}

/// Copia el instalador en ejecución para poder volver a abrirlo desde Windows.
Future<String> copySetupRuntime(String destRoot) async {
  final exe = File(Platform.resolvedExecutable);
  final source = exe.parent;
  final dest = Directory(destRoot);
  if (p.normalize(source.path).toLowerCase() == p.normalize(dest.path).toLowerCase()) {
    return exe.path;
  }
  dest.createSync(recursive: true);
  await _copyTree(source, dest);
  return p.join(dest.path, p.basename(exe.path));
}

Future<void> _copyTree(Directory source, Directory dest) async {
  dest.createSync(recursive: true);
  for (final entity in source.listSync(followLinks: false)) {
    final name = p.basename(entity.path);
    if (name == 'uninstall') continue;
    final target = p.join(dest.path, name);
    if (entity is File) {
      await File(entity.path).copy(target);
    } else if (entity is Directory) {
      await _copyTree(Directory(entity.path), Directory(target));
    }
  }
}

/// Si Windows abrió el desinstalador dentro de la carpeta de GameNow,
/// lo relanza desde una copia temporal para poder borrar esa carpeta.
Future<void> relaunchSetupOutsideInstall(String appDir, List<String> args) async {
  if (!executableInside(appDir)) return;
  final temp = await Directory.systemTemp.createTemp('gamenow_setup_');
  final exe = await copySetupRuntime(temp.path);
  await Process.start(
    exe,
    args,
    workingDirectory: p.dirname(exe),
    mode: ProcessStartMode.detached,
  );
  exit(0);
}

List<String> installedFileNames(String appDir) {
  final root = Directory(appDir);
  if (!root.existsSync()) return const ['gamenow.exe'];
  final names = <String>[];
  for (final entity in root.listSync(recursive: true, followLinks: false)) {
    if (entity is! File) continue;
    final relative = p.relative(entity.path, from: appDir);
    if (relative.toLowerCase().startsWith('uninstall${Platform.pathSeparator}')) continue;
    names.add(relative);
    if (names.length >= 24) break;
  }
  if (names.isEmpty) names.add('gamenow.exe');
  return names;
}

int _folderSizeKb(String dir) {
  var bytes = 0;
  final root = Directory(dir);
  if (!root.existsSync()) return 1;
  for (final entity in root.listSync(recursive: true, followLinks: false)) {
    if (entity is File) {
      try {
        bytes += entity.lengthSync();
      } catch (_) {}
    }
  }
  return (bytes / 1024).ceil();
}

Future<void> uninstallGameNow(
  String appDir, {
  void Function(double progress, String status)? onProgress,
}) async {
  onProgress?.call(0.15, 'Cerrando GameNow...');
  try {
    await Process.run('taskkill', ['/F', '/T', '/IM', 'gamenow.exe']);
  } catch (_) {}
  await Future.delayed(const Duration(milliseconds: 250));

  onProgress?.call(0.45, 'Quitando accesos directos...');
  const shortcuts = r'''
$d = [Environment]::GetFolderPath('Desktop')
if ($d) { Remove-Item (Join-Path $d 'GameNow.lnk') -Force -ErrorAction SilentlyContinue }
$p = [Environment]::GetFolderPath('Programs')
if ($p) { Remove-Item (Join-Path $p 'GameNow.lnk') -Force -ErrorAction SilentlyContinue }
Remove-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GameNow' -Recurse -Force -ErrorAction SilentlyContinue
''';
  await Process.run('powershell', ['-NoProfile', '-Command', shortcuts]);

  onProgress?.call(0.75, 'Eliminando archivos de GameNow...');
  final dest = Directory(appDir);
  // WebView2 helper processes keep files in gamenow.exe.WebView2 locked briefly after the app exits.
  for (var attempt = 1; dest.existsSync(); attempt++) {
    try {
      dest.deleteSync(recursive: true);
    } on FileSystemException {
      if (attempt >= 10) rethrow;
      await Future.delayed(const Duration(milliseconds: 500));
    }
  }

  onProgress?.call(1.0, 'GameNow se desinstaló.');
}

Future<void> openGameNow(String exePath) {
  return Process.start(
    exePath,
    [],
    workingDirectory: p.dirname(exePath),
    mode: ProcessStartMode.detached,
  );
}
