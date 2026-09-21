import 'dart:io';

const _builtIn = String.fromEnvironment(
  'STORE_URL',
  defaultValue: 'http://127.0.0.1:5173',
);

String storeUrl() {
  final fromEnv = Platform.environment['GAMENOW_STORE_URL']?.trim();
  final base = (fromEnv != null && fromEnv.isNotEmpty) ? fromEnv : _builtIn;
  final uri = Uri.parse(base);
  final newParams = Map<String, String>.from(uri.queryParameters);
  newParams['app'] = '1';
  return uri.replace(queryParameters: newParams).toString();
}
