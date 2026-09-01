import 'dart:io';

import 'package:flutter/material.dart';

import 'install.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const GameNowSetupApp());
}

class GameNowSetupApp extends StatelessWidget {
  const GameNowSetupApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GameNow',
      debugShowCheckedModeBanner: false,
      theme: gameNowTheme(),
      home: const SetupPage(),
    );
  }
}

enum SetupStep { home, work, done, error }

class SetupPage extends StatefulWidget {
  const SetupPage({super.key});

  @override
  State<SetupPage> createState() => _SetupPageState();
}

class _SetupPageState extends State<SetupPage> {
  SetupStep _step = SetupStep.home;
  bool _desktop = false;
  String _error = '';
  String _exePath = '';

  Future<void> _install() async {
    setState(() => _step = SetupStep.work);
    try {
      final result = await installGameNow(desktopShortcut: _desktop);
      if (!mounted) return;
      setState(() {
        _exePath = result.exePath;
        _step = SetupStep.done;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Hubo un problema. Cierra GameNow si está abierto e inténtalo de nuevo.';
        _step = SetupStep.error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GameNowColors.canvas,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
              child: _body(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _body() {
    switch (_step) {
      case SetupStep.home:
        return _Home(
          desktop: _desktop,
          onDesktop: (value) => setState(() => _desktop = value),
          onInstall: _install,
          onQuit: () => exit(0),
        );
      case SetupStep.work:
        return const _Work();
      case SetupStep.done:
        return _Done(
          onOpen: () async {
            await openGameNow(_exePath);
            exit(0);
          },
          onClose: () => exit(0),
        );
      case SetupStep.error:
        return _Fail(
          message: _error,
          onRetry: _install,
          onQuit: () => exit(0),
        );
    }
  }
}

class _Home extends StatelessWidget {
  const _Home({
    required this.desktop,
    required this.onDesktop,
    required this.onInstall,
    required this.onQuit,
  });

  final bool desktop;
  final ValueChanged<bool> onDesktop;
  final VoidCallback onInstall;
  final VoidCallback onQuit;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Image.asset('assets/vortex-256.png', width: 72, height: 72, filterQuality: FilterQuality.high),
        const SizedBox(height: 32),
        Text(
          'Tu biblioteca,\nuna sola app.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.displaySmall,
        ),
        const SizedBox(height: 24),
        Text(
          'La tienda, tus compras y tus juegos quedan en una ventana. Tarda poco y no toca el resto de tu PC.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 32),
        _DesktopToggle(value: desktop, onChanged: onDesktop),
        const SizedBox(height: 40),
        _AccentButton(label: 'Instalar GameNow', onPressed: onInstall),
        const SizedBox(height: 16),
        _TextAction(label: 'Ahora no', onPressed: onQuit),
      ],
    );
  }
}

class _Work extends StatelessWidget {
  const _Work();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Image.asset('assets/vortex-256.png', width: 72, height: 72, filterQuality: FilterQuality.high),
        const SizedBox(height: 32),
        Text('Un momento.', textAlign: TextAlign.center, style: Theme.of(context).textTheme.displaySmall),
        const SizedBox(height: 16),
        Text(
          'Estamos copiando GameNow en tu PC.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 40),
        const SizedBox(
          width: 280,
          child: ClipRRect(
            borderRadius: BorderRadius.all(Radius.circular(8)),
            child: LinearProgressIndicator(
              minHeight: 6,
              color: GameNowColors.accent,
              backgroundColor: GameNowColors.surface,
            ),
          ),
        ),
      ],
    );
  }
}

class _Done extends StatelessWidget {
  const _Done({required this.onOpen, required this.onClose});

  final VoidCallback onOpen;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Image.asset('assets/vortex-256.png', width: 72, height: 72, filterQuality: FilterQuality.high),
        const SizedBox(height: 32),
        Text(
          'GameNow ya está\nen tu PC.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.displaySmall,
        ),
        const SizedBox(height: 16),
        Text(
          'Ábrelo cuando quieras. La tienda y tu biblioteca quedan en la misma ventana.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 40),
        _AccentButton(label: 'Abrir GameNow', onPressed: onOpen),
        const SizedBox(height: 16),
        _TextAction(label: 'Cerrar', onPressed: onClose),
      ],
    );
  }
}

class _Fail extends StatelessWidget {
  const _Fail({required this.message, required this.onRetry, required this.onQuit});

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onQuit;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('No se pudo instalar.', textAlign: TextAlign.center, style: Theme.of(context).textTheme.displaySmall),
        const SizedBox(height: 16),
        Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
        const SizedBox(height: 40),
        _AccentButton(label: 'Reintentar', onPressed: onRetry),
        const SizedBox(height: 16),
        _TextAction(label: 'Ahora no', onPressed: onQuit),
      ],
    );
  }
}

class _AccentButton extends StatefulWidget {
  const _AccentButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  State<_AccentButton> createState() => _AccentButtonState();
}

class _AccentButtonState extends State<_AccentButton> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: AnimatedScale(
        scale: _hover ? 1.02 : 1,
        duration: const Duration(milliseconds: 220),
        curve: const Cubic(0.16, 1, 0.3, 1),
        child: FilledButton(
          onPressed: widget.onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: GameNowColors.accent,
            foregroundColor: GameNowColors.onAccent,
            minimumSize: const Size(280, 56),
            padding: const EdgeInsets.symmetric(horizontal: 32),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            textStyle: Theme.of(context).textTheme.labelLarge,
          ),
          child: Text(widget.label),
        ),
      ),
    );
  }
}

class _TextAction extends StatelessWidget {
  const _TextAction({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: GameNowColors.muted,
        textStyle: Theme.of(context).textTheme.bodySmall,
      ),
      child: Text(label),
    );
  }
}

class _DesktopToggle extends StatelessWidget {
  const _DesktopToggle({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: value ? GameNowColors.accent : GameNowColors.surface,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: value ? GameNowColors.accent : GameNowColors.border),
              ),
              child: value
                  ? const Icon(Icons.check, size: 14, color: GameNowColors.onAccent)
                  : null,
            ),
            const SizedBox(width: 12),
            Text('Poner GameNow en el escritorio', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

