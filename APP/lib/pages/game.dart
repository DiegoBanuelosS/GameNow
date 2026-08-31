import 'package:flutter/material.dart';

import '../api.dart';
import '../pc.dart';
import '../theme.dart';

class GamePage extends StatefulWidget {
  const GamePage({super.key, required this.slug});

  final String slug;

  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage> {
  late Future<Map<String, dynamic>> _product;
  late Future<Map<String, dynamic>> _fit;

  @override
  void initState() {
    super.initState();
    _product = fetchProduct(widget.slug);
    _fit = readPc().then((pc) => fetchPcFit(widget.slug, pc));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Juego')),
      body: FutureBuilder(
        future: _product,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: accent));
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const Center(child: Text('No se pudo cargar este juego.'));
          }
          final product = snapshot.data!;
          final table = product['requirementsTable'];
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                product['name']?.toString() ?? '',
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: fg),
              ),
              const SizedBox(height: 8),
              Text(
                product['price']?.toString() ?? '',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: fg),
              ),
              const SizedBox(height: 24),
              FutureBuilder(
                future: _fit,
                builder: (context, fitSnap) {
                  if (fitSnap.connectionState != ConnectionState.done) {
                    return const _FitCard(
                      title: '¿Corre en tu PC?',
                      body: 'Leyendo tu equipo…',
                    );
                  }
                  if (fitSnap.hasError || fitSnap.data == null) {
                    return const _FitCard(
                      title: '¿Corre en tu PC?',
                      body: 'No pudimos comprobar tu PC. Arranca la API.',
                      bad: true,
                    );
                  }
                  final fit = fitSnap.data!;
                  final verdict = fit['verdict']?.toString() ?? 'unknown';
                  return _FitCard(
                    title: fit['title']?.toString() ?? '¿Corre en tu PC?',
                    body: '${fit['detail'] ?? ''}\n${fit['machine'] ?? ''}'.trim(),
                    bad: verdict == 'no' || verdict == 'poor',
                  );
                },
              ),
              const SizedBox(height: 24),
              Text(
                product['description']?.toString() ?? '',
                style: const TextStyle(color: muted, height: 1.5),
              ),
              if (table is List && table.isNotEmpty) ...[
                const SizedBox(height: 32),
                const Text(
                  'Requisitos',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: fg),
                ),
                const SizedBox(height: 12),
                Table(
                  columnWidths: const {
                    0: FlexColumnWidth(1.1),
                    1: FlexColumnWidth(2),
                    2: FlexColumnWidth(2),
                  },
                  children: [
                    const TableRow(
                      children: [
                        _Cell('Componente', head: true),
                        _Cell('Mínimos', head: true),
                        _Cell('Máximos', head: true),
                      ],
                    ),
                    ...table.whereType<Map>().map((row) {
                      return TableRow(
                        children: [
                          _Cell(row['label']?.toString() ?? ''),
                          _Cell(row['min']?.toString() ?? ''),
                          _Cell(row['max']?.toString() ?? ''),
                        ],
                      );
                    }),
                  ],
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _FitCard extends StatelessWidget {
  const _FitCard({required this.title, required this.body, this.bad = false});

  final String title;
  final String body;
  final bool bad;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: bad ? const Color(0xFFD97A74) : border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('¿Corre en tu PC?', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: fg)),
          const SizedBox(height: 8),
          Text(title, style: TextStyle(color: bad ? critical : fg, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Text(body, style: const TextStyle(color: muted)),
        ],
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell(this.text, {this.head = false});

  final String text;
  final bool head;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      child: Text(
        text,
        style: TextStyle(
          color: head ? fg : muted,
          fontWeight: head ? FontWeight.w600 : FontWeight.w400,
          fontSize: 13,
        ),
      ),
    );
  }
}
