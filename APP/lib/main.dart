import 'package:flutter/material.dart';

import 'pages/store_webview.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
