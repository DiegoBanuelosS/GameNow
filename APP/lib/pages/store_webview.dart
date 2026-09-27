import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_windows/webview_windows.dart';

import '../pc.dart';
import '../store_url.dart';
import '../theme.dart';
import '../widgets/app_title_bar.dart';
import '../widgets/custom_toasts.dart';

class StoreWebViewPage extends StatefulWidget {
  const StoreWebViewPage({super.key});

  @override
  State<StoreWebViewPage> createState() => _StoreWebViewPageState();
}

class _StoreWebViewPageState extends State<StoreWebViewPage> {
  final WebviewController _controller = WebviewController();
  final CustomToastController _toasts = CustomToastController();
  StreamSubscription<dynamic>? _webMessageSub;
  late final Future<Map<String, dynamic>> _pcSpecs = readPc().catchError((_) => <String, dynamic>{});
  bool _ready = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _toasts.addListener(_onToastsChanged);
    unawaited(_pcSpecs);
    unawaited(_openStore());
  }

  Future<void> _sendPcSpecs() async {
    final specs = await _pcSpecs;
    if (!mounted || !_controller.value.isInitialized) return;
    try {
      await _controller.executeScript(
        'window.__gamenowPcSpecs && window.__gamenowPcSpecs(${jsonEncode(specs)});',
      );
    } catch (_) {}
  }

  void _onToastsChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    unawaited(_webMessageSub?.cancel() ?? Future<void>.value());
    _toasts.removeListener(_onToastsChanged);
    _toasts.dispose();
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
    if (data['action'] == 'pc') {
      unawaited(_sendPcSpecs());
      return;
    }
    if (data['action'] != 'notify') return;

    final raw = data['toast'];
    Map<String, dynamic>? toastMap;
    if (raw is Map) {
      toastMap = raw.map((key, value) => MapEntry('$key', value));
    }
    if (toastMap == null) return;
    _toasts.push(AppToastData.fromMap(toastMap));
  }

  Future<void> _respondFriend(String id, String action) async {
    _toasts.dismiss(id);
    if (!_controller.value.isInitialized) return;
    final safeId = id.replaceAll(r'\', r'\\').replaceAll("'", r"\'");
    final safeAction = action == 'accept' ? 'accept' : 'reject';
    try {
      await _controller.executeScript(
        "window.__gamenowRespondFriend && window.__gamenowRespondFriend('$safeId', '$safeAction');",
      );
    } catch (_) {}
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
        await _webMessageSub?.cancel();
        _webMessageSub = _controller.webMessage.listen(_onWebMessage);
      }
      final appUrl = targetUrl.contains('?') ? '$targetUrl&app=1' : '$targetUrl?app=1';
      await _controller.loadUrl(appUrl);
      if (!mounted) return;
      setState(() => _ready = true);
    } on PlatformException catch (e) {
      if (!mounted) return;
      setState(() {
        _error =
            'Error de inicialización de WebView2: ${e.message ?? e.code}.\nAsegúrate de tener Microsoft Edge WebView2 Runtime instalado en Windows.';
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
    _dispatchScroll(
      -event.panDelta.dx * 1.5,
      -event.panDelta.dy * 1.5,
      event.localPosition.dx,
      event.localPosition.dy,
    );
  }

  FutureOr<WebviewPermissionDecision> _onPermissionRequested(
    String url,
    WebviewPermissionKind kind,
    bool isUserInitiated,
  ) {
    if (kind == WebviewPermissionKind.clipboardRead) {
      return WebviewPermissionDecision.allow;
    }
    // Nunca usar notificaciones nativas de Windows.
    return WebviewPermissionDecision.deny;
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
                    child: Webview(
                      _controller,
                      permissionRequested: _onPermissionRequested,
                    ),
                  ),
                if (!_ready) _Splash(error: _error, onRetry: _openStore),
                CustomToastOverlay(
                  items: List<AppToastData>.from(_toasts.items),
                  onDismiss: _toasts.dismiss,
                  onFriendAction: (id, action) => unawaited(_respondFriend(id, action)),
                ),
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
