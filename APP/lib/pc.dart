import 'pc_stub.dart' if (dart.library.io) 'pc_io.dart' as impl;

Future<Map<String, dynamic>> readPc() => impl.readPc();
