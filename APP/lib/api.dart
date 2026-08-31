import 'dart:convert';

import 'package:http/http.dart' as http;

const apiBase = String.fromEnvironment(
  'GAMENOW_API',
  defaultValue: 'http://127.0.0.1:8787',
);

Future<Map<String, dynamic>> _get(String path) async {
  final response = await http.get(Uri.parse('$apiBase$path'));
  if (response.statusCode >= 400) {
    throw Exception('No se pudo leer $path');
  }
  return jsonDecode(response.body) as Map<String, dynamic>;
}

Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> data) async {
  final response = await http.post(
    Uri.parse('$apiBase$path'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode(data),
  );
  if (response.statusCode >= 400) {
    throw Exception('No se pudo enviar $path');
  }
  return jsonDecode(response.body) as Map<String, dynamic>;
}

Future<List<Map<String, dynamic>>> fetchGames() async {
  final payload = await _get('/api/games');
  final games = payload['games'];
  if (games is! List) {
    return [];
  }
  return games.whereType<Map<String, dynamic>>().toList();
}

Future<Map<String, dynamic>> fetchProduct(String slug) {
  return _get('/api/products/$slug');
}

Future<Map<String, dynamic>> fetchPcFit(String slug, Map<String, dynamic> pc) {
  return _post('/api/pc-fit', {'slug': slug, ...pc});
}
