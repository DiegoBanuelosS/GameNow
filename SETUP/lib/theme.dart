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

ThemeData gameNowTheme() {
  const scheme = ColorScheme.dark(
    surface: GameNowColors.canvas,
    primary: GameNowColors.accent,
    onPrimary: GameNowColors.onAccent,
    secondary: GameNowColors.subtle,
    onSurface: GameNowColors.text,
    error: GameNowColors.critical,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: GameNowColors.canvas,
    fontFamily: 'Sora',
    textTheme: const TextTheme(
      displaySmall: TextStyle(
        fontFamily: 'Sora',
        fontWeight: FontWeight.w600,
        fontSize: 36,
        height: 1.05,
        color: GameNowColors.text,
      ),
      bodyLarge: TextStyle(
        fontFamily: 'Sora',
        fontWeight: FontWeight.w400,
        fontSize: 16,
        height: 1.5,
        color: GameNowColors.muted,
      ),
      bodySmall: TextStyle(
        fontFamily: 'Sora',
        fontWeight: FontWeight.w400,
        fontSize: 14,
        height: 1.45,
        color: GameNowColors.muted,
      ),
      labelLarge: TextStyle(
        fontFamily: 'Sora',
        fontWeight: FontWeight.w600,
        fontSize: 16,
        height: 1,
        color: GameNowColors.onAccent,
      ),
    ),
  );
}
