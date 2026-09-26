import 'package:flutter/material.dart';
import 'package:local_notifier/local_notifier.dart';

import 'pages/store_webview.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await localNotifier.setup(
      appName: 'GameNow',
      shortcutPolicy: ShortcutPolicy.requireCreate,
    );
  } catch (_) {
    /* sin atajo de notificaciones sigue la app */
  }
  runApp(const GameNowApp());
}

class GameNowApp extends StatelessWidget {
  const GameNowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GameNow',
      debugShowCheckedModeBanner: false,
      theme: gameNowTheme(),
      home: const StoreWebViewPage(),
    );
  }
}
