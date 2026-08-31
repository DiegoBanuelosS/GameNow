import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import 'game.dart';

class StorePage extends StatefulWidget {
  const StorePage({super.key});

  @override
  State<StorePage> createState() => _StorePageState();
}

class _StorePageState extends State<StorePage> {
  late Future<List<Map<String, dynamic>>> _games;

  @override
  void initState() {
    super.initState();
    _games = fetchGames();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tienda')),
      body: FutureBuilder(
        future: _games,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: accent));
          }
          if (snapshot.hasError) {
            return const Center(
              child: Text('No se pudo cargar Nuestros Juegos. Arranca la API.'),
            );
          }
          final games = snapshot.data ?? [];
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: games.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final game = games[index];
              final name = game['name']?.toString() ?? '';
              final price = game['price']?.toString() ?? '';
              final slug = game['slug']?.toString() ?? '';
              final cover = game['cover']?.toString() ?? '';
              return ListTile(
                tileColor: surface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                leading: cover.isEmpty
                    ? const SizedBox(width: 72, height: 40)
                    : Image.network(cover, width: 72, height: 40, fit: BoxFit.cover),
                title: Text(name, style: const TextStyle(color: fg)),
                subtitle: Text(price, style: const TextStyle(color: muted)),
                onTap: slug.isEmpty
                    ? null
                    : () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => GamePage(slug: slug)),
                        );
                      },
              );
            },
          );
        },
      ),
    );
  }
}
