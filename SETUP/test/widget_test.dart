import 'package:flutter_test/flutter_test.dart';
import 'package:gamenow_setup/main.dart';

void main() {
  testWidgets('muestra la pantalla de instalación', (tester) async {
    await tester.pumpWidget(const GameNowSetupApp());
    expect(find.text('Instalar GameNow'), findsOneWidget);
    expect(find.textContaining('Tu biblioteca'), findsOneWidget);
  });
}
