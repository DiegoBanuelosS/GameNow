import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_windows/webview_windows.dart';

import '../store_url.dart';
import '../theme.dart';

class StoreWebViewPage extends StatefulWidget {
  const StoreWebViewPage({super.key});

  @override
  State<StoreWebViewPage> createState() => _StoreWebViewPageState();
}

class _StoreWebViewPageState extends State<StoreWebViewPage> {
  final WebviewController _controller = WebviewController();
  bool _ready = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_openStore());
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

  Future<bool> _storeIsUp(String url) async {
    try {
      final uri = Uri.parse(url);
      final client = HttpClient()..connectionTimeout = const Duration(seconds: 3);
      final request = await client.getUrl(uri);
      request.headers.set(HttpHeaders.userAgentHeader, 'GameNow/1.0');
      final response = await request.close().timeout(const Duration(seconds: 4));
      await response.drain<void>();
      client.close(force: true);
      return response.statusCode < 500;
    } catch (_) {
      return false;
    }
  }

  Future<void> _openStore() async {
    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return;
    }
    setState(() {
      _ready = false;
      _error = null;
    });

    final url = storeUrl();
    final up = await _storeIsUp(url);
    if (!up) {
      if (!mounted) return;
      setState(() {
        _error =
            'No pudimos abrir la tienda en $url. Arranca WWW (puerto 5173) y la API, o define GAMENOW_STORE_URL.';
      });
      return;
    }

    try {
      if (!_controller.value.isInitialized) {
        await _controller.initialize();
        await _controller.setBackgroundColor(GameNowColors.canvas);
        await _controller.setPopupWindowPolicy(WebviewPopupWindowPolicy.deny);
      }
      await _controller.loadUrl(url);
      if (!mounted) return;
      setState(() => _ready = true);
    } on PlatformException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message ?? 'WebView2 no está disponible en este equipo.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
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
          if (!_ready) _Splash(error: _error, onRetry: _openStore),
        ],
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash({required this.error, required this.onRetry});

  final String? error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: GameNowColors.canvas,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset(
                  'assets/vortex-256.png',
                  width: 72,
                  height: 72,
                  filterQuality: FilterQuality.high,
                ),
                const SizedBox(height: 28),
                Text(
                  error == null ? 'Abriendo GameNow…' : 'No se pudo abrir la tienda',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: GameNowColors.text,
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                if (error == null)
                  const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: GameNowColors.accent,
                    ),
                  )
                else ...[
                  Text(
                    error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: GameNowColors.muted,
                      fontSize: 14,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: () => unawaited(onRetry()),
                    child: const Text('Reintentar'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
