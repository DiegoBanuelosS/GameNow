import 'dart:io';

const _builtIn = String.fromEnvironment(
  'STORE_URL',
  defaultValue: 'http://127.0.0.1:5173',
);

String storeUrl() {
  final fromEnv = Platform.environment['GAMENOW_STORE_URL']?.trim();
  if (fromEnv != null && fromEnv.isNotEmpty) {
    return fromEnv;
  }
  return _builtIn;
}
