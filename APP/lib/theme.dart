import 'package:flutter/material.dart';

class GameNowColors {
  static const canvas = Color(0xFF000000);
  static const surface = Color(0xFF1A1815);
  static const subtle = Color(0xFF221F1B);
  static const text = Color(0xFFECE7DE);
  static const muted = Color(0xFF9C9588);
  static const accent = Color(0xFFF2622E);
  static const onAccent = Color(0xFF1A120E);
  static const border = Color(0xFF2E2B26);
  static const critical = Color(0xFFF0B4AF);
}

const canvas = GameNowColors.canvas;
const surface = GameNowColors.surface;
const subtle = GameNowColors.subtle;
const fg = GameNowColors.text;
const muted = GameNowColors.muted;
const accent = GameNowColors.accent;
const onAccent = GameNowColors.onAccent;
const border = GameNowColors.border;
const critical = GameNowColors.critical;

ThemeData gameNowTheme() {
  const scheme = ColorScheme.dark(
    surface: canvas,
    primary: accent,
    onPrimary: onAccent,
    secondary: subtle,
    onSurface: fg,
    error: critical,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: canvas,
    fontFamily: 'Segoe UI',
    appBarTheme: const AppBarTheme(
      backgroundColor: canvas,
      foregroundColor: fg,
      elevation: 0,
    ),
    cardTheme: const CardThemeData(
      color: surface,
      margin: EdgeInsets.zero,
    ),
  );
}
