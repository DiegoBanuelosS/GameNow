import 'dart:io';

const _builtIn = String.fromEnvironment(
  'STORE_URL',
  defaultValue: 'https://gamenow-549.pages.dev',
);

List<String> candidateStoreUrls() {
  final fromEnv = Platform.environment['GAMENOW_STORE_URL']?.trim();
  final bases = [
    if (fromEnv != null && fromEnv.isNotEmpty) fromEnv,
    _builtIn,
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
