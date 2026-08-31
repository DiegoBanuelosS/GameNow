import 'dart:convert';
import 'dart:io';

Future<Map<String, dynamic>> readPc() async {
  if (!Platform.isWindows) {
    return {'os': '', 'cpu': '', 'gpu': '', 'ramGb': null};
  }

  const script = r'''
$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name)
$gpu = (Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'Basic' } | Select-Object -First 1 -ExpandProperty Name)
if (-not $gpu) { $gpu = (Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name) }
$ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$os = (Get-CimInstance Win32_OperatingSystem).Caption
@{ os = $os; cpu = "$cpu"; gpu = "$gpu"; ramGb = $ram } | ConvertTo-Json -Compress
''';

  final result = await Process.run('powershell', [
    '-NoProfile',
    '-WindowStyle',
    'Hidden',
    '-Command',
    script,
  ]);
  if (result.exitCode != 0) {
    return {'os': 'Windows', 'cpu': '', 'gpu': '', 'ramGb': null};
  }
  final decoded = jsonDecode(result.stdout.toString()) as Map<String, dynamic>;
  return {
    'os': decoded['os']?.toString() ?? '',
    'cpu': decoded['cpu']?.toString() ?? '',
    'gpu': decoded['gpu']?.toString() ?? '',
    'ramGb': decoded['ramGb'],
  };
}
