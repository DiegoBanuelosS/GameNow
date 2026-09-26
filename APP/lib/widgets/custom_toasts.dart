import 'dart:async';

import 'package:flutter/material.dart';

import '../theme.dart';

class AppToastData {
  AppToastData({
    required this.id,
    required this.kind,
    required this.name,
    this.avatarUrl = '',
    this.backgroundUrl = '',
    this.cover = '',
    this.text = '',
    this.steamId = '',
    this.fromUserId = '',
    this.slug = '',
  });

  final String id;
  final String kind;
  final String name;
  final String avatarUrl;
  final String backgroundUrl;
  final String cover;
  final String text;
  final String steamId;
  final String fromUserId;
  final String slug;

  factory AppToastData.fromMap(Map<String, dynamic> map) {
    return AppToastData(
      id: '${map['id'] ?? DateTime.now().millisecondsSinceEpoch}',
      kind: '${map['kind'] ?? ''}',
      name: '${map['name'] ?? ''}',
      avatarUrl: '${map['avatarUrl'] ?? ''}',
      backgroundUrl: '${map['backgroundUrl'] ?? ''}',
      cover: '${map['cover'] ?? ''}',
      text: '${map['text'] ?? ''}',
      steamId: '${map['steamId'] ?? ''}',
      fromUserId: '${map['fromUserId'] ?? ''}',
      slug: '${map['slug'] ?? ''}',
    );
  }

  Duration get autoDismiss {
    switch (kind) {
      case 'friend-request':
        return const Duration(seconds: 18);
      case 'message':
        return const Duration(seconds: 8);
      default:
        return const Duration(seconds: 7);
    }
  }
}

class CustomToastOverlay extends StatelessWidget {
  const CustomToastOverlay({
    super.key,
    required this.items,
    required this.onDismiss,
    required this.onFriendAction,
  });

  final List<AppToastData> items;
  final void Function(String id) onDismiss;
  final void Function(String id, String action) onFriendAction;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Positioned(
      top: 52,
      right: 16,
      width: 440,
      child: IgnorePointer(
        ignoring: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final item in items) ...[
              _ToastCard(
                item: item,
                onDismiss: () => onDismiss(item.id),
                onAccept: () => onFriendAction(item.id, 'accept'),
                onReject: () => onFriendAction(item.id, 'reject'),
              ),
              const SizedBox(height: 10),
            ],
          ],
        ),
      ),
    );
  }
}

class _ToastCard extends StatelessWidget {
  const _ToastCard({
    required this.item,
    required this.onDismiss,
    required this.onAccept,
    required this.onReject,
  });

  final AppToastData item;
  final VoidCallback onDismiss;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    if (item.kind == 'friend-request') return _FriendToast(item: item, onAccept: onAccept, onReject: onReject);
    if (item.kind == 'message') return _MessageToast(item: item);
    return _GameToast(item: item);
  }
}

class _ToastShell extends StatelessWidget {
  const _ToastShell({required this.child, this.padding});

  final Widget child;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xEB14110E),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: GameNowColors.border.withValues(alpha: 0.8)),
          boxShadow: const [
            BoxShadow(color: Color(0x73000000), blurRadius: 40, offset: Offset(0, 18)),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        padding: padding,
        child: child,
      ),
    );
  }
}

class _FriendToast extends StatelessWidget {
  const _FriendToast({
    required this.item,
    required this.onAccept,
    required this.onReject,
  });

  final AppToastData item;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final bg = item.backgroundUrl.isNotEmpty ? item.backgroundUrl : item.avatarUrl;
    return _ToastShell(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      child: Stack(
        children: [
          if (bg.isNotEmpty)
            Positioned.fill(
              child: Align(
                alignment: Alignment.centerRight,
                child: FractionallySizedBox(
                  widthFactor: 0.62,
                  child: ShaderMask(
                    blendMode: BlendMode.dstIn,
                    shaderCallback: (bounds) => const LinearGradient(
                      colors: [Colors.transparent, Colors.black],
                      stops: [0.0, 0.42],
                    ).createShader(bounds),
                    child: Opacity(
                      opacity: 0.55,
                      child: Image.network(bg, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox()),
                    ),
                  ),
                ),
              ),
            ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'NUEVA SOLICITUD DE AMISTAD',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                  color: GameNowColors.muted,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _Avatar(url: item.avatarUrl),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      item.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: GameNowColors.text,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _PillButton(label: 'Aceptar', filled: true, onTap: onAccept),
                  const SizedBox(width: 6),
                  _PillButton(label: 'Rechazar', filled: false, onTap: onReject),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GameToast extends StatelessWidget {
  const _GameToast({required this.item});

  final AppToastData item;

  @override
  Widget build(BuildContext context) {
    final label = item.kind == 'game-downloaded' ? 'Descargado' : 'Listo para jugar';
    return _ToastShell(
      child: SizedBox(
        height: 78,
        child: Row(
          children: [
            SizedBox(
              width: 156,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (item.cover.isNotEmpty)
                    Image.network(item.cover, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: const Color(0xFF2A2621)))
                  else
                    Container(color: const Color(0xFF2A2621)),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.transparent, Color(0x8C14110E), Color(0xFF14110E)],
                        stops: [0.35, 0.72, 1],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 12, 14, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      item.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: GameNowColors.text,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: GameNowColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageToast extends StatelessWidget {
  const _MessageToast({required this.item});

  final AppToastData item;

  @override
  Widget build(BuildContext context) {
    return _ToastShell(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      child: Column(
        children: [
          Row(
            children: [
              _Avatar(url: item.avatarUrl),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: GameNowColors.text,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            item.text,
            textAlign: TextAlign.center,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              height: 1.4,
              color: GameNowColors.text.withValues(alpha: 0.88),
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xFF2A2621),
        border: Border.all(color: Colors.white24),
        image: url.isEmpty
            ? null
            : DecorationImage(image: NetworkImage(url), fit: BoxFit.cover),
      ),
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({
    required this.label,
    required this.filled,
    required this.onTap,
  });

  final String label;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? GameNowColors.accent : Colors.white.withValues(alpha: 0.06),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: filled ? null : Border.all(color: Colors.white24),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: filled ? GameNowColors.onAccent : GameNowColors.text,
            ),
          ),
        ),
      ),
    );
  }
}

/// Controlador simple para apilar toasts personalizados en Flutter.
class CustomToastController extends ChangeNotifier {
  final List<AppToastData> items = [];
  final Map<String, Timer> _timers = {};

  void push(AppToastData toast) {
    items.removeWhere((item) => item.id == toast.id);
    if (toast.kind == 'friend-request') {
      items.removeWhere(
        (item) =>
            item.kind == 'friend-request' &&
            item.steamId == toast.steamId &&
            item.fromUserId == toast.fromUserId,
      );
    }
    if (toast.kind == 'game-downloaded' || toast.kind == 'game-ready') {
      items.removeWhere((item) => item.kind == toast.kind && item.slug == toast.slug);
    }
    items.insert(0, toast);
    if (items.length > 5) {
      final dropped = items.sublist(5);
      items.removeRange(5, items.length);
      for (final item in dropped) {
        _timers.remove(item.id)?.cancel();
      }
    }
    _timers[toast.id]?.cancel();
    _timers[toast.id] = Timer(toast.autoDismiss, () => dismiss(toast.id));
    notifyListeners();
  }

  void dismiss(String id) {
    _timers.remove(id)?.cancel();
    final before = items.length;
    items.removeWhere((item) => item.id == id);
    if (items.length != before) notifyListeners();
  }

  @override
  void dispose() {
    for (final timer in _timers.values) {
      timer.cancel();
    }
    _timers.clear();
    super.dispose();
  }
}
