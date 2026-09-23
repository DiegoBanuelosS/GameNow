import 'dart:io';

const _builtIn = String.fromEnvironment(
  'STORE_URL',
  defaultValue: 'http://localhost:5173',
);

List<String> candidateStoreUrls() {
  final fromEnv = Platform.environment['GAMENOW_STORE_URL']?.trim();
  final bases = [
    if (fromEnv != null && fromEnv.isNotEmpty) fromEnv,
    _builtIn,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ];

  final results = <String>[];
  for (final base in bases) {
    try {
      final uri = Uri.parse(base);
      final newParams = Map<String, String>.from(uri.queryParameters);
      newParams['app'] = '1';
      final full = uri.replace(queryParameters: newParams).toString();
      if (!results.contains(full)) {
        results.add(full);
      }
    } catch (_) {}
  }
  return results;
}

String storeUrl() {
  return candidateStoreUrls().first;
}
