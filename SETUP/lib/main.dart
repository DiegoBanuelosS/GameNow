import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'install.dart';
import 'maintenance_page.dart';
import 'theme.dart';

Future<void> main(List<String> args) async {
  WidgetsFlutterBinding.ensureInitialized();
  var launchArgs = args;
  if (launchArgs.isEmpty) {
    try {
      final raw = await _windowChannel.invokeMethod<dynamic>('args');
      if (raw is List) {
        launchArgs = raw.map((item) => '$item').toList();
      }
    } catch (_) {}
  }

  ExistingInstall? existing;
  try {
    existing = await findExistingInstall();
  } catch (_) {}

  if (existing != null && executableInside(existing.appDir)) {
    try {
      await relaunchSetupOutsideInstall(existing.appDir, launchArgs);
    } catch (_) {}
  }

  runApp(GameNowSetupApp(
    maintenance: launchedForUninstall(launchArgs) || existing != null,
    existing: existing,
  ));
}

// ---------------------------------------------------------------------------
// MethodChannel para controles de ventana nativos (Minimizar, Cerrar, Arrastrar)
// ---------------------------------------------------------------------------
const _windowChannel = MethodChannel('gamenow/window');

Future<void> _minimizeWindow() async {
  try {
    await _windowChannel.invokeMethod('minimize');
  } catch (_) {}
}

Future<void> _closeWindow() async {
  try {
    await _windowChannel.invokeMethod('close');
  } catch (_) {
    exit(0);
  }
}

Future<void> _startDragWindow() async {
  try {
    await _windowChannel.invokeMethod('drag');
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Aplicación Principal Flutter
// ---------------------------------------------------------------------------
class GameNowSetupApp extends StatelessWidget {
  const GameNowSetupApp({super.key, this.maintenance = false, this.existing});

  final bool maintenance;
  final ExistingInstall? existing;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GameNow - Instalador',
      debugShowCheckedModeBanner: false,
      theme: gameNowTheme(),
      home: maintenance
          ? MaintenancePage(existing: existing)
          : const InstallerWindow(),
    );
  }
}

enum InstallerStep { welcome, location, maintenance, progress, error }

enum _ProgressMode { install, repair, update, uninstall }

class InstallerWindow extends StatefulWidget {
  const InstallerWindow({super.key});

  @override
  State<InstallerWindow> createState() => _InstallerWindowState();
}

class _InstallerWindowState extends State<InstallerWindow>
    with SingleTickerProviderStateMixin {
  InstallerStep _step = InstallerStep.welcome;
  bool _desktopShortcut = true;
  late TextEditingController _pathController;

  double _progress = 0.0;
  String _statusText = 'Iniciando instalación...';
  String _errorMessage = '';
  String _installedExePath = '';
  String _existingAppDir = '';
  _ProgressMode _progressMode = _ProgressMode.install;
  bool _busy = false;

  late AnimationController _bannerAnimController;
  late Animation<double> _bannerHeightAnim;
  late Animation<double> _bannerOpacityAnim;

  @override
  void initState() {
    super.initState();
    String defaultPath = 'C:\\Program Files\\GameNow';
    try {
      defaultPath = installDir();
    } catch (_) {}
    _pathController = TextEditingController(text: defaultPath);

    _bannerAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );

    _bannerHeightAnim = Tween<double>(begin: 320.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _bannerAnimController,
        curve: const Cubic(0.7, 0.0, 0.2, 1.0),
      ),
    );

    _bannerOpacityAnim = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _bannerAnimController,
        curve: Curves.easeInOut,
      ),
    );

  }

  @override
  void dispose() {
    _pathController.dispose();
    _bannerAnimController.dispose();
    super.dispose();
  }

  void _goToStep(InstallerStep nextStep) {
    setState(() => _step = nextStep);
    if (nextStep == InstallerStep.welcome) {
      _bannerAnimController.reverse();
    } else {
      _bannerAnimController.forward();
    }
  }

  Future<void> _startRepair() async {
    _progressMode = _ProgressMode.repair;
    _pathController.text = _existingAppDir;
    await _startInstallation();
  }

  Future<void> _startUpdate() async {
    _progressMode = _ProgressMode.update;
    _pathController.text = _existingAppDir;
    await _startInstallation();
  }

  Future<void> _startUninstall({bool skipConfirm = false}) async {
    if (_busy || _existingAppDir.isEmpty) return;

    if (!skipConfirm) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: GameNowColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            'Desinstalar GameNow',
            style: TextStyle(
              fontFamily: 'Sora',
              fontWeight: FontWeight.w600,
              color: GameNowColors.text,
            ),
          ),
          content: const Text(
            'Se eliminarán la aplicación y sus accesos directos.',
            style: TextStyle(
              fontFamily: 'Sora',
              fontSize: 14,
              color: GameNowColors.muted,
              height: 1.45,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar', style: TextStyle(color: GameNowColors.muted)),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: GameNowColors.accent,
                foregroundColor: GameNowColors.onAccent,
              ),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Desinstalar'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }

    _progressMode = _ProgressMode.uninstall;
    _busy = true;
    _goToStep(InstallerStep.progress);
    setState(() {
      _progress = 0.08;
      _statusText = 'Preparando la desinstalación...';
      _installedExePath = '';
    });

    try {
      await uninstallGameNow(
        _existingAppDir,
        onProgress: (prog, text) {
          if (!mounted) return;
          setState(() {
            _progress = prog;
            _statusText = text;
          });
        },
      );
      if (!mounted) return;
      setState(() {
        _existingAppDir = '';
        _progress = 1.0;
        _statusText = 'Se quitaron los archivos y accesos directos.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage =
            'No se pudo desinstalar GameNow. Ciérralo si sigue abierto e inténtalo de nuevo.\n\nDetalle: $e';
        _step = InstallerStep.error;
      });
    } finally {
      _busy = false;
    }
  }

  Future<void> _startInstallation() async {
    if (_busy) return;
    _busy = true;
    if (_progressMode != _ProgressMode.repair && _progressMode != _ProgressMode.update) {
      _progressMode = _ProgressMode.install;
    }
    _goToStep(InstallerStep.progress);
    setState(() {
      _progress = 0.0;
      _statusText = _progressMode == _ProgressMode.repair
          ? 'Reparando la instalación...'
          : _progressMode == _ProgressMode.update
              ? 'Buscando actualizaciones...'
              : 'Preparando espacio y archivos...';
    });

    try {
      final result = await installGameNow(
        targetDir: _pathController.text.trim(),
        desktopShortcut: _desktopShortcut,
        preferRemote: _progressMode == _ProgressMode.update,
        onProgress: (prog, text) {
          if (!mounted) return;
          setState(() {
            _progress = prog;
            _statusText = text;
          });
        },
      );

      if (!mounted) return;
      setState(() {
        _installedExePath = result.exePath;
        _progress = 1.0;
        _statusText = 'Instalación completada con éxito.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage =
            'Hubo un problema durante la instalación. Cierra GameNow si está abierto e inténtalo de nuevo.\n\nDetalle: $e';
        _step = InstallerStep.error;
      });
    } finally {
      _busy = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GameNowColors.canvas,
      body: SizedBox(
        width: 1085,
        height: 710,
        child: Stack(
          children: [
            // 1. Aura ambiental difusa en el fondo
            Positioned.fill(
              child: IgnorePointer(
                child: Center(
                  child: Container(
                    width: 760,
                    height: 520,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          Colors.white.withOpacity(0.04),
                          Colors.white.withOpacity(0.01),
                          Colors.transparent,
                        ],
                        stops: const [0.0, 0.45, 0.8],
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // 2. Columna principal (Hero banner superior animado + contenido)
            Column(
              children: [
                // Banner superior con imagen artwork y degradado inferior a negro
                AnimatedBuilder(
                  animation: _bannerAnimController,
                  builder: (context, child) {
                    final height = _bannerHeightAnim.value;
                    if (height <= 0.01) return const SizedBox.shrink();
                    return SizedBox(
                      height: height,
                      width: double.infinity,
                      child: Opacity(
                        opacity: _bannerOpacityAnim.value,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            Image.asset(
                              'assets/header.webp',
                              fit: BoxFit.cover,
                              alignment: const Alignment(0.0, -0.35),
                              errorBuilder: (_, __, ___) =>
                                  Container(color: const Color(0xFF0C0C0C)),
                            ),
                            // Sombra superior para contraste de controles
                            Positioned(
                              top: 0,
                              left: 0,
                              right: 0,
                              height: 120,
                              child: Container(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.black.withOpacity(0.75),
                                      Colors.black.withOpacity(0.2),
                                      Colors.transparent,
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            // Degradado inferior hacia negro puro (hero-fade)
                            Positioned(
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: 180,
                              child: Container(
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.transparent,
                                      Color(0x22000000),
                                      Color(0x88000000),
                                      Color(0xDF000000),
                                      GameNowColors.canvas,
                                    ],
                                    stops: [0.0, 0.35, 0.65, 0.85, 1.0],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),

                // Contenido central interactivo
                Expanded(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 680),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 32),
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 380),
                          switchInCurve: const Cubic(0.16, 1.0, 0.3, 1.0),
                          switchOutCurve: Curves.easeOutQuad,
                          transitionBuilder: (child, animation) {
                            return FadeTransition(
                              opacity: animation,
                              child: SlideTransition(
                                position: Tween<Offset>(
                                  begin: const Offset(0.0, 0.06),
                                  end: Offset.zero,
                                ).animate(animation),
                                child: child,
                              ),
                            );
                          },
                          child: _buildStepContent(),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),

            // 3. Logo centrado en la parte superior
            Positioned(
              top: 26,
              left: 0,
              right: 0,
              child: Center(
                child: MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: GestureDetector(
                    onTap: () {
                      if (_step == InstallerStep.location) {
                        _goToStep(InstallerStep.welcome);
                      }
                    },
                    child: Image.asset(
                      'assets/logo.png',
                      height: 52,
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.high,
                      errorBuilder: (_, __, ___) => Image.asset(
                        'assets/vortex-256.png',
                        height: 52,
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // 4. Barra superior nativa arrastrable con controles (Minimizar / Cerrar) arriba a la derecha
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 48,
              child: Row(
                children: [
                  // Área arrastrable de la ventana
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onPanStart: (_) => _startDragWindow(),
                      child: const SizedBox.expand(),
                    ),
                  ),

                  // Botón Minimizar
                  _TitleBarButton(
                    icon: Icons.remove,
                    tooltip: 'Minimizar',
                    onPressed: _minimizeWindow,
                  ),

                  // Botón Cerrar
                  _TitleBarButton(
                    icon: Icons.close,
                    tooltip: 'Cerrar',
                    isClose: true,
                    onPressed: _closeWindow,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case InstallerStep.welcome:
        return _StepWelcome(
          key: const ValueKey('step-welcome'),
          onContinue: () => _goToStep(InstallerStep.location),
        );
      case InstallerStep.location:
        return _StepLocation(
          key: const ValueKey('step-location'),
          controller: _pathController,
          desktopShortcut: _desktopShortcut,
          onDesktopShortcutChanged: (val) =>
              setState(() => _desktopShortcut = val),
          onBack: () => _goToStep(InstallerStep.welcome),
          onInstall: _startInstallation,
        );
      case InstallerStep.maintenance:
        return _StepMaintenance(
          key: const ValueKey('step-maintenance'),
          onUninstall: _startUninstall,
          onUpdate: _startUpdate,
          onRepair: _startRepair,
          onClose: _closeWindow,
        );
      case InstallerStep.progress:
        return _StepProgress(
          key: const ValueKey('step-progress'),
          progress: _progress,
          statusText: _statusText,
          busyTitle: _progressMode == _ProgressMode.uninstall
              ? 'Desinstalando GameNow...'
              : _progressMode == _ProgressMode.repair
                  ? 'Reparando GameNow...'
                  : _progressMode == _ProgressMode.update
                      ? 'Actualizando GameNow...'
                      : 'Instalando GameNow...',
          doneTitle: _progressMode == _ProgressMode.uninstall
              ? 'GameNow se desinstaló'
              : _progressMode == _ProgressMode.update
                  ? 'GameNow se actualizó'
                  : 'GameNow ya está instalado',
          finishLabel: _progressMode == _ProgressMode.uninstall ? 'Cerrar' : 'Abrir GameNow',
          onFinish: () async {
            if (_progressMode != _ProgressMode.uninstall && _installedExePath.isNotEmpty) {
              await openGameNow(_installedExePath);
            }
            exit(0);
          },
        );
      case InstallerStep.error:
        return _StepError(
          key: const ValueKey('step-error'),
          message: _errorMessage,
          onRetry: _progressMode == _ProgressMode.uninstall
              ? () => _startUninstall(skipConfirm: true)
              : _startInstallation,
          onQuit: () => exit(0),
        );
    }
  }
}

// ---------------------------------------------------------------------------
// Paso 1: Bienvenida ("Todos Tus Juegos En Un Solo Lugar")
// ---------------------------------------------------------------------------
class _StepWelcome extends StatelessWidget {
  const _StepWelcome({super.key, required this.onContinue});

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Todos Tus Juegos En Un Solo Lugar',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Sora',
            fontSize: 32,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.5,
            color: GameNowColors.text,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Tu biblioteca completa, la tienda y tus comunidades sincronizadas en una sola aplicación rápida y elegante.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Sora',
            fontSize: 15,
            color: GameNowColors.muted,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 38),
        _PrimaryActionButton(
          label: 'Continuar',
          onPressed: onContinue,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Instalación existente: Desinstalar, Reparar o Cerrar
// ---------------------------------------------------------------------------
class _StepMaintenance extends StatelessWidget {
  const _StepMaintenance({
    super.key,
    required this.onUninstall,
    required this.onUpdate,
    required this.onRepair,
    required this.onClose,
  });

  final VoidCallback onUninstall;
  final VoidCallback onUpdate;
  final VoidCallback onRepair;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'GameNow ya está instalado',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Sora',
            fontSize: 32,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.5,
            color: GameNowColors.text,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Elige qué quieres hacer con la instalación actual.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Sora',
            fontSize: 15,
            color: GameNowColors.muted,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 36),
        _PrimaryActionButton(
          label: 'Actualizar',
          onPressed: onUpdate,
        ),
        const SizedBox(height: 12),
        _SecondaryActionButton(
          label: 'Reparar',
          onPressed: onRepair,
        ),
        const SizedBox(height: 12),
        _SecondaryActionButton(
          label: 'Desinstalar',
          onPressed: onUninstall,
        ),
        const SizedBox(height: 12),
        _SecondaryActionButton(
          label: 'Cerrar',
          onPressed: onClose,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Paso 2: Ubicación de Instalación ("¿Dónde quieres instalar GameNow?")
// ---------------------------------------------------------------------------
class _StepLocation extends StatefulWidget {
  const _StepLocation({
    super.key,
    required this.controller,
    required this.desktopShortcut,
    required this.onDesktopShortcutChanged,
    required this.onBack,
    required this.onInstall,
  });

  final TextEditingController controller;
  final bool desktopShortcut;
  final ValueChanged<bool> onDesktopShortcutChanged;
  final VoidCallback onBack;
  final VoidCallback onInstall;

  @override
  State<_StepLocation> createState() => _StepLocationState();
}

class _StepLocationState extends State<_StepLocation> {
  void _browseDirectory() {
    showDialog(
      context: context,
      builder: (ctx) {
        final dirController =
            TextEditingController(text: widget.controller.text);
        return AlertDialog(
          backgroundColor: GameNowColors.surface,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            'Ruta de Instalación',
            style: TextStyle(
                fontFamily: 'Sora',
                fontWeight: FontWeight.w600,
                color: GameNowColors.text),
          ),
          content: TextField(
            controller: dirController,
            autofocus: true,
            style: const TextStyle(
                fontFamily: 'Sora', fontSize: 14, color: GameNowColors.text),
            decoration: InputDecoration(
              hintText: 'Introduce la ruta completa...',
              hintStyle: const TextStyle(color: GameNowColors.muted),
              filled: true,
              fillColor: GameNowColors.subtle,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide:
                    const BorderSide(color: GameNowColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide:
                    const BorderSide(color: GameNowColors.accent),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar',
                  style: TextStyle(color: GameNowColors.muted)),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: GameNowColors.accent,
                foregroundColor: GameNowColors.onAccent,
              ),
              onPressed: () {
                if (dirController.text.trim().isNotEmpty) {
                  widget.controller.text = dirController.text.trim();
                }
                Navigator.pop(ctx);
              },
              child: const Text('Guardar'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          '¿Dónde quieres instalar GameNow?',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Sora',
            fontSize: 28,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.4,
            color: GameNowColors.text,
            height: 1.25,
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Elige la carpeta donde se copiarán los archivos y ejecutables.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Sora',
            fontSize: 14,
            color: GameNowColors.muted,
          ),
        ),
        const SizedBox(height: 36),

        // Campo de entrada de ruta + botón examinar
        Container(
          width: 580,
          decoration: BoxDecoration(
            color: GameNowColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: GameNowColors.border),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Row(
            children: [
              const Icon(Icons.folder_outlined,
                  size: 20, color: GameNowColors.muted),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  style: const TextStyle(
                    fontFamily: 'Sora',
                    fontSize: 14,
                    color: GameNowColors.text,
                  ),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _BrowseButton(onPressed: _browseDirectory),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Opción: Acceso directo en el escritorio
        InkWell(
          onTap: () =>
              widget.onDesktopShortcutChanged(!widget.desktopShortcut),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: widget.desktopShortcut
                        ? GameNowColors.accent
                        : GameNowColors.surface,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: widget.desktopShortcut
                          ? GameNowColors.accent
                          : GameNowColors.border,
                    ),
                  ),
                  child: widget.desktopShortcut
                      ? const Icon(Icons.check,
                          size: 14, color: GameNowColors.onAccent)
                      : null,
                ),
                const SizedBox(width: 12),
                const Text(
                  'Poner GameNow en el escritorio',
                  style: TextStyle(
                    fontFamily: 'Sora',
                    fontSize: 14,
                    color: GameNowColors.muted,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 36),

        // Acciones: Atrás e Instalar
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextButton(
              onPressed: widget.onBack,
              style: TextButton.styleFrom(
                foregroundColor: GameNowColors.muted,
                padding:
                    const EdgeInsets.symmetric(horizontal: 28, vertical: 18),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text(
                'Atrás',
                style: TextStyle(
                  fontFamily: 'Sora',
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(width: 16),
            _PrimaryActionButton(
              label: 'Instalar',
              onPressed: widget.onInstall,
            ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Paso 3: Barra de Progreso de Instalación
// (Sin glow, checkmark blanco con animación al finalizar)
// ---------------------------------------------------------------------------
class _StepProgress extends StatefulWidget {
  const _StepProgress({
    super.key,
    required this.progress,
    required this.statusText,
    required this.onFinish,
    this.busyTitle = 'Instalando GameNow...',
    this.doneTitle = 'GameNow ya está instalado',
    this.finishLabel = 'Abrir GameNow',
  });

  final double progress;
  final String statusText;
  final VoidCallback onFinish;
  final String busyTitle;
  final String doneTitle;
  final String finishLabel;

  @override
  State<_StepProgress> createState() => _StepProgressState();
}

class _StepProgressState extends State<_StepProgress>
    with SingleTickerProviderStateMixin {
  late AnimationController _popController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _popController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _scaleAnimation = CurvedAnimation(
      parent: _popController,
      curve: const Cubic(0.16, 1.0, 0.3, 1.0),
    );
  }

  @override
  void didUpdateWidget(covariant _StepProgress oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.progress >= 1.0 && oldWidget.progress < 1.0) {
      _popController.forward(from: 0.0);
    }
  }

  @override
  void dispose() {
    _popController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool isFinished = widget.progress >= 1.0;
    final int percentInt = (widget.progress * 100).clamp(0, 100).toInt();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Checkmark blanco con animación Pop / Escala al llegar al 100%
        AnimatedBuilder(
          animation: _popController,
          builder: (context, child) {
            if (!isFinished) {
              return const SizedBox(height: 56);
            }
            return Opacity(
              opacity: _scaleAnimation.value.clamp(0.0, 1.0),
              child: Transform.scale(
                scale: 0.3 + (_scaleAnimation.value * 0.7),
                child: Container(
                  width: 56,
                  height: 56,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2.2),
                  ),
                  child: const Icon(
                    Icons.check,
                    color: Colors.white,
                    size: 32,
                  ),
                ),
              ),
            );
          },
        ),

        // Título del paso
        Text(
          isFinished ? widget.doneTitle : widget.busyTitle,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontFamily: 'Sora',
            fontSize: 28,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.3,
            color: GameNowColors.text,
          ),
        ),
        const SizedBox(height: 32),

        // Barra de progreso (sin glow, diseño minimalista premium)
        SizedBox(
          width: 560,
          child: Column(
            children: [
              Container(
                height: 10,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: GameNowColors.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: GameNowColors.border),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: widget.progress.clamp(0.0, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: GameNowColors.accent,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      widget.statusText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'Sora',
                        fontSize: 13,
                        color: GameNowColors.muted,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Text(
                    '$percentInt%',
                    style: const TextStyle(
                      fontFamily: 'Sora',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: GameNowColors.text,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 40),

        // Botón principal al finalizar
        if (isFinished)
          _PrimaryActionButton(
            label: widget.finishLabel,
            onPressed: widget.onFinish,
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Paso de Error
// ---------------------------------------------------------------------------
class _StepError extends StatelessWidget {
  const _StepError({
    super.key,
    required this.message,
    required this.onRetry,
    required this.onQuit,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onQuit;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.error_outline, size: 48, color: GameNowColors.critical),
        const SizedBox(height: 20),
        const Text(
          'No se pudo completar la instalación',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Sora',
            fontSize: 26,
            fontWeight: FontWeight.w600,
            color: GameNowColors.text,
          ),
        ),
        const SizedBox(height: 14),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontFamily: 'Sora',
            fontSize: 14,
            color: GameNowColors.muted,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 36),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextButton(
              onPressed: onQuit,
              style: TextButton.styleFrom(
                foregroundColor: GameNowColors.muted,
                padding:
                    const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
              ),
              child: const Text('Salir'),
            ),
            const SizedBox(width: 16),
            _PrimaryActionButton(
              label: 'Reintentar',
              onPressed: onRetry,
            ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Componentes Reutilizables de Interfaz
// ---------------------------------------------------------------------------

// Botón de acción primario (blanco con texto negro, animado al hover)
class _PrimaryActionButton extends StatefulWidget {
  const _PrimaryActionButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  State<_PrimaryActionButton> createState() => _PrimaryActionButtonState();
}

class _PrimaryActionButtonState extends State<_PrimaryActionButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: AnimatedScale(
        scale: _isHovered ? 1.02 : 1.0,
        duration: const Duration(milliseconds: 200),
        curve: const Cubic(0.16, 1.0, 0.3, 1.0),
        child: FilledButton(
          onPressed: widget.onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: _isHovered
                ? GameNowColors.accentHover
                : GameNowColors.accent,
            foregroundColor: GameNowColors.onAccent,
            minimumSize: const Size(240, 52),
            padding: const EdgeInsets.symmetric(horizontal: 36),
            elevation: _isHovered ? 8 : 2,
            shadowColor: Colors.white.withOpacity(0.2),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: Text(
            widget.label,
            style: const TextStyle(
              fontFamily: 'Sora',
              fontSize: 15,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.2,
            ),
          ),
        ),
      ),
    );
  }
}

class _SecondaryActionButton extends StatefulWidget {
  const _SecondaryActionButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  State<_SecondaryActionButton> createState() => _SecondaryActionButtonState();
}

class _SecondaryActionButtonState extends State<_SecondaryActionButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: OutlinedButton(
        onPressed: widget.onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: _isHovered ? GameNowColors.subtle : Colors.transparent,
          foregroundColor: GameNowColors.text,
          minimumSize: const Size(240, 52),
          side: BorderSide(
            color: _isHovered ? GameNowColors.accent : GameNowColors.border,
          ),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: Text(
          widget.label,
          style: const TextStyle(
            fontFamily: 'Sora',
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.2,
          ),
        ),
      ),
    );
  }
}

// Botón examinar carpeta
class _BrowseButton extends StatefulWidget {
  const _BrowseButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  State<_BrowseButton> createState() => _BrowseButtonState();
}

class _BrowseButtonState extends State<_BrowseButton> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: OutlinedButton(
        onPressed: widget.onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: _hover ? GameNowColors.subtle : Colors.transparent,
          foregroundColor: _hover ? Colors.white : GameNowColors.text,
          side: BorderSide(
              color: _hover ? GameNowColors.accent : GameNowColors.border),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: const Text(
          'Examinar',
          style: TextStyle(fontFamily: 'Sora', fontSize: 13, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

// Botones de la barra de título (Minimizar / Cerrar)
class _TitleBarButton extends StatefulWidget {
  const _TitleBarButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.isClose = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final bool isClose;

  @override
  State<_TitleBarButton> createState() => _TitleBarButtonState();
}

class _TitleBarButtonState extends State<_TitleBarButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final Color hoverColor = widget.isClose
        ? const Color(0xFFC42B1C)
        : Colors.white.withOpacity(0.08);

    return Tooltip(
      message: widget.tooltip,
      waitDuration: const Duration(milliseconds: 500),
      child: MouseRegion(
        onEnter: (_) => setState(() => _isHovered = true),
        onExit: (_) => setState(() => _isHovered = false),
        child: GestureDetector(
          onTap: widget.onPressed,
          child: Container(
            width: 46,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _isHovered ? hoverColor : Colors.transparent,
            ),
            child: Icon(
              widget.icon,
              size: 15,
              color: Colors.white.withOpacity(_isHovered ? 1.0 : 0.75),
            ),
          ),
        ),
      ),
    );
  }
}
