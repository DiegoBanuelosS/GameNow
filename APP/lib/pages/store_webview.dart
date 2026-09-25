import 'dart:async';
import 'dart:io';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_windows/webview_windows.dart';

import '../store_url.dart';
import '../theme.dart';
import '../widgets/app_title_bar.dart';

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

  Future<String?> _resolveStoreUrl() async {
    final candidates = candidateStoreUrls();
    for (final url in candidates) {
      if (await _storeIsUp(url)) {
        return url;
      }
    }
    return null;
  }

  Future<void> _openStore() async {
    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return;
    }
    setState(() {
      _ready = false;
      _error = null;
    });

    final targetUrl = await _resolveStoreUrl();
    if (targetUrl == null) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudo conectar con la tienda. Revisa tu conexión a internet.';
      });
      return;
    }

    try {
      if (!_controller.value.isInitialized) {
        await _controller.initialize();
        await _controller.setBackgroundColor(GameNowColors.canvas);
        await _controller.setPopupWindowPolicy(WebviewPopupWindowPolicy.deny);
      }
      final appUrl = targetUrl.contains('?') ? '$targetUrl&app=1' : '$targetUrl?app=1';
      await _controller.loadUrl(appUrl);
      if (!mounted) return;
      setState(() => _ready = true);
    } on PlatformException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Error de inicialización de WebView2: ${e.message ?? e.code}.\nAsegúrate de tener Microsoft Edge WebView2 Runtime instalado en Windows.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Hubo un problema al cargar la tienda: $e';
      });
    }
  }

  void _dispatchScroll(double dx, double dy, double x, double y) {
    if (!_controller.value.isInitialized) return;
    _controller.executeScript('''
      (function() {
        var el = document.elementFromPoint($x, $y);
        while (el && el !== document.body && el !== document.documentElement) {
          var s = window.getComputedStyle(el);
          var overflowY = s.overflowY;
          var overflowX = s.overflowX;
          var canScrollY = (overflowY === 'auto' || overflowY === 'scroll') && (el.scrollHeight > el.clientHeight);
          var canScrollX = (overflowX === 'auto' || overflowX === 'scroll') && (el.scrollWidth > el.clientWidth);
          if (canScrollY || canScrollX) {
            var prevTop = el.scrollTop;
            var prevLeft = el.scrollLeft;
            el.scrollBy($dx, $dy);
            if (el.scrollTop !== prevTop || el.scrollLeft !== prevLeft) {
              return;
            }
          }
          el = el.parentElement;
        }

        var prevY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        window.scrollBy($dx, $dy);
        var currY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        if (currY === prevY) {
          if (document.documentElement) document.documentElement.scrollTop += $dy;
          if (document.body) document.body.scrollTop += $dy;
          var root = document.getElementById('root');
          if (root) root.scrollTop += $dy;
          var store = document.querySelector('.store');
          if (store) store.scrollTop += $dy;
        }
      })();
    ''').catchError((_) {});
  }

  void _handlePointerSignal(PointerSignalEvent signal) {
    if (signal is PointerScrollEvent) {
      _dispatchScroll(
        signal.scrollDelta.dx,
        signal.scrollDelta.dy,
        signal.localPosition.dx,
        signal.localPosition.dy,
      );
    }
  }

  void _handlePointerPanZoomUpdate(PointerPanZoomUpdateEvent event) {
    // Invert panDelta so trackpad natural scrolling scrolls down when dragging fingers up
    _dispatchScroll(
      -event.panDelta.dx * 1.5,
      -event.panDelta.dy * 1.5,
      event.localPosition.dx,
      event.localPosition.dy,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GameNowColors.canvas,
      body: Column(
        children: [
          const AppTitleBar(),
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (_ready)
                  Listener(
                    onPointerSignal: _handlePointerSignal,
                    onPointerPanZoomUpdate: _handlePointerPanZoomUpdate,
                    child: Webview(_controller),
                  ),
                if (!_ready) _Splash(error: _error, onRetry: _openStore),
              ],
            ),
          ),
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
