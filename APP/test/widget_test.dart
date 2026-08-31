import 'package:flutter_test/flutter_test.dart';
import 'package:gamenow/main.dart';

void main() {
  testWidgets('abre la app GameNow', (tester) async {
    await tester.pumpWidget(const GameNowApp());
    expect(find.text('Abriendo GameNow…'), findsOneWidget);
  });
}
