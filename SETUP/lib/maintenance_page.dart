import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:webview_windows/webview_windows.dart';

import 'install.dart';
import 'theme.dart';

const _windowChannel = MethodChannel('gamenow/window');

class MaintenancePage extends StatefulWidget {
  const MaintenancePage({super.key, this.existing});

  final ExistingInstall? existing;

  @override
  State<MaintenancePage> createState() => _MaintenancePageState();
}

class _MaintenancePageState extends State<MaintenancePage> {
  final WebviewController _controller = WebviewController();
  bool _ready = false;
  String? _error;
  bool _busy = false;
  ExistingInstall? _existing;

  @override
  void initState() {
    super.initState();
    _existing = widget.existing;
    _open();
  }

  @override
  void dispose() {
    try {
      if (_controller.value.isInitialized) {
        _controller.dispose();
      }
    } catch (_) {}
    super.dispose();
  }

  Future<void> _open() async {
    try {
      final page = await _materializeUi();
      await _controller.initialize();
      await _controller.setBackgroundColor(GameNowColors.canvas);
      await _controller.setPopupWindowPolicy(WebviewPopupWindowPolicy.deny);
      _controller.webMessage.listen(_onWebMessage);
      await _controller.loadUrl(Uri.file(page.path).toString());
      if (!mounted) return;
      setState(() => _ready = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    }
  }

  Future<File> _materializeUi() async {
    final root = await Directory.systemTemp.createTemp('gamenow_ui_');
    const files = [
      'UI/uninstall.html',
      'UI/style.css',
      'UI/assets/logo.svg',
      'UI/assets/672903.jpg',
      'UI/assets/672904.jpg',
    ];
    for (final asset in files) {
      final data = await rootBundle.load(asset);
      final out = File(p.join(root.path, asset.substring('UI/'.length)));
      out.parent.createSync(recursive: true);
      await out.writeAsBytes(
        data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
      );
    }
    return File(p.join(root.path, 'uninstall.html'));
  }

  Future<void> _onWebMessage(dynamic message) async {
    Map<String, dynamic>? data;
    if (message is Map) {
      data = message.map((key, value) => MapEntry('$key', value));
    } else if (message is String) {
      try {
        final decoded = jsonDecode(message);
        if (decoded is Map) {
          data = decoded.map((key, value) => MapEntry('$key', value));
        }
      } catch (_) {}
    }
    if (data == null) return;
    switch (data['action']) {
      case 'close':
        await _close();
        return;
      case 'uninstall':
        await _runUninstall();
        return;
      case 'repair':
        await _runRepair();
        return;
    }
  }

  Future<void> _close() async {
    try {
      await _windowChannel.invokeMethod('close');
    } catch (_) {
      exit(0);
    }
  }

  Future<void> _push(Map<String, Object?> payload) async {
    if (!_controller.value.isInitialized) return;
    final json = jsonEncode(payload);
    await _controller.executeScript('window.applySetupUpdate($json);');
  }

  Future<void> _runUninstall() async {
    if (_busy) return;
    final install = _existing;
    if (install == null) {
      await _push({
        'mode': 'uninstall',
        'title': 'GameNow no está instalado',
        'done': true,
        'percent': 100,
      });
      return;
    }
    _busy = true;
    try {
      await uninstallGameNow(
        install.appDir,
        onProgress: (progress, status) {
          _push({
            'mode': 'uninstall',
            'percent': (progress * 100).round(),
            'title': 'Esperamos Volverte a ver Pronto',
            'status': status,
          });
        },
      );
      _existing = null;
      await _push({
        'mode': 'uninstall',
        'percent': 100,
        'title': 'GameNow fue Desinstalado Exitosamente',
        'done': true,
      });
    } catch (e) {
      await _push({
        'mode': 'uninstall',
        'title': 'No se pudo desinstalar GameNow',
        'status': '$e',
        'done': true,
        'percent': 100,
      });
    } finally {
      _busy = false;
    }
  }

  Future<void> _runRepair() async {
    if (_busy) return;
    final install = _existing;
    if (install == null) {
      await _push({
        'mode': 'repair',
        'title': 'GameNow no está instalado',
        'done': true,
        'percent': 100,
      });
      return;
    }
    _busy = true;
    final files = installedFileNames(install.appDir);
    var fileCursor = 0;
    try {
      for (var step = 0; step < 8; step++) {
        final name = files[fileCursor % files.length];
        fileCursor++;
        await _push({
          'mode': 'repair',
          'percent': (step / 8 * 25).round(),
          'title': step < 4 ? 'Revisando tu instalación' : 'Buscando problemas',
          'status': 'Revisando $name',
        });
        await Future<void>.delayed(const Duration(milliseconds: 220));
      }

      await installGameNow(
        targetDir: install.appDir,
        desktopShortcut: true,
        onProgress: (progress, status) {
          final scaled = 0.25 + (progress * 0.75);
          final title = scaled < 0.5
              ? 'Buscando problemas'
              : scaled < 0.75
                  ? 'Corrigiendo los problemas'
                  : 'Descargando';
          final file = files[fileCursor % files.length];
          final downloading = title == 'Descargando';
          if (downloading) fileCursor++;
          final detail = status.contains('\\') || status.contains('/')
              ? status
              : downloading
                  ? 'Descargando $file'
                  : 'Revisando $file';
          _push({
            'mode': 'repair',
            'percent': (scaled * 100).round(),
            'title': title,
            'status': detail.startsWith('Extrayendo:')
                ? detail.replaceFirst('Extrayendo:', 'Descargando')
                : detail,
          });
        },
      );
      _existing = ExistingInstall(appDir: install.appDir, exePath: install.exePath);
      await _push({
        'mode': 'repair',
        'percent': 100,
        'title': 'GameNow Fue reparado Exitosamente',
        'done': true,
      });
    } catch (e) {
      await _push({
        'mode': 'repair',
        'title': 'No se pudo reparar GameNow',
        'status': '$e',
        'done': true,
        'percent': 100,
      });
    } finally {
      _busy = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GameNowColors.canvas,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (_ready) Webview(_controller),
          if (!_ready)
            Center(
              child: Text(
                _error ?? 'Abriendo GameNow...',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Sora',
                  color: GameNowColors.muted,
                  fontSize: 14,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
