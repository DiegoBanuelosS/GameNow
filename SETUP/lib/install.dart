import 'dart:io';

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

Future<InstallResult> installGameNow({required bool desktopShortcut}) async {
  final dest = Directory(installDir());
  if (dest.existsSync()) {
    dest.deleteSync(recursive: true);
  }
  dest.createSync(recursive: true);

  final payload = await rootBundle.load('assets/payload.zip');
  final archive = ZipDecoder().decodeBytes(payload.buffer.asUint8List());
  if (archive.isEmpty) {
    throw const FormatException('El paquete de GameNow está vacío.');
  }

  for (final file in archive) {
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
  }

  final exe = File(p.join(dest.path, 'gamenow.exe'));
  if (!exe.existsSync()) {
    throw const FileSystemException('No encontramos gamenow.exe en el paquete.');
  }

  await _writeUninstall(dest.path, exe.path);
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
