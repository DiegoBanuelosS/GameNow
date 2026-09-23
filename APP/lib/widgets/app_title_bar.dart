import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme.dart';

class AppTitleBar extends StatefulWidget {
  const AppTitleBar({super.key});

  static const double height = 38.0;

  @override
  State<AppTitleBar> createState() => _AppTitleBarState();
}

class _AppTitleBarState extends State<AppTitleBar> {
  static const MethodChannel _windowChannel = MethodChannel('gamenow/window');
  bool _isMaximized = false;

  @override
  void initState() {
    super.initState();
    _checkMaximizedState();
  }

  Future<void> _checkMaximizedState() async {
    try {
      final isMax = await _windowChannel.invokeMethod<bool>('isMaximized');
      if (mounted && isMax != null) {
        setState(() => _isMaximized = isMax);
      }
    } catch (_) {}
  }

  void _dragWindow() {
    _windowChannel.invokeMethod('drag');
  }

  Future<void> _toggleMaximize() async {
    try {
      final isMax = await _windowChannel.invokeMethod<bool>('maximize');
      if (mounted && isMax != null) {
        setState(() => _isMaximized = isMax);
      }
    } catch (_) {}
  }

  void _minimize() {
    _windowChannel.invokeMethod('minimize');
  }

  void _close() {
    _windowChannel.invokeMethod('close');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: AppTitleBar.height,
      color: const Color(0xFF000000),
      child: Row(
        children: [
          // Draggable area covering the top bar (excluding window buttons)
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onPanStart: (_) => _dragWindow(),
              onDoubleTap: _toggleMaximize,
              child: const SizedBox.expand(),
            ),
          ),

          // Window action controls
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _WindowButton(
                tooltip: 'Minimizar',
                onPressed: _minimize,
                icon: const Icon(Icons.remove, size: 16),
              ),
              _WindowButton(
                tooltip: _isMaximized ? 'Restaurar' : 'Maximizar',
                onPressed: _toggleMaximize,
                icon: Icon(
                  _isMaximized
                      ? Icons.filter_none_rounded
                      : Icons.crop_square_rounded,
                  size: _isMaximized ? 13 : 15,
                ),
              ),
              _WindowButton(
                tooltip: 'Cerrar',
                isClose: true,
                onPressed: _close,
                icon: const Icon(Icons.close_rounded, size: 17),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _WindowButton extends StatefulWidget {
  const _WindowButton({
    required this.icon,
    required this.onPressed,
    this.isClose = false,
    this.tooltip,
  });

  final Widget icon;
  final VoidCallback onPressed;
  final bool isClose;
  final String? tooltip;

  @override
  State<_WindowButton> createState() => _WindowButtonState();
}

class _WindowButtonState extends State<_WindowButton> {
  bool _isHovered = false;
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color iconColor;

    if (widget.isClose) {
      if (_isPressed) {
        bg = const Color(0xFFB81B1B);
        iconColor = Colors.white;
      } else if (_isHovered) {
        bg = const Color(0xFFE81123);
        iconColor = Colors.white;
      } else {
        bg = Colors.transparent;
        iconColor = GameNowColors.muted;
      }
    } else {
      if (_isPressed) {
        bg = const Color(0xFF2E2B26);
        iconColor = GameNowColors.text;
      } else if (_isHovered) {
        bg = const Color(0xFF221F1B);
        iconColor = GameNowColors.text;
      } else {
        bg = Colors.transparent;
        iconColor = GameNowColors.muted;
      }
    }

    Widget content = MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() {
        _isHovered = false;
        _isPressed = false;
      }),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) => setState(() => _isPressed = false),
        onTapCancel: () => setState(() => _isPressed = false),
        onTap: widget.onPressed,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 100),
          width: 46,
          height: AppTitleBar.height,
          alignment: Alignment.center,
          color: bg,
          child: IconTheme(
            data: IconThemeData(
              color: iconColor,
            ),
            child: widget.icon,
          ),
        ),
      ),
    );

    if (widget.tooltip != null) {
      return Tooltip(
        message: widget.tooltip!,
        waitDuration: const Duration(milliseconds: 600),
        child: content,
      );
    }

    return content;
  }
}
