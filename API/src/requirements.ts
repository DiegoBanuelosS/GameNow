export type RequirementRow = {
  label: string;
  min: string;
  max: string;
};

const ORDER = [
  "SO",
  "Procesador",
  "Memoria",
  "Gráficos",
  "DirectX",
  "Red",
  "Almacenamiento",
  "Notas",
];

const CANON: [RegExp, string][] = [
  [/^(os|so|sistema operativo)$/i, "SO"],
  [/^(processor|procesador)$/i, "Procesador"],
  [/^(memory|memoria|memoria ram|ram)$/i, "Memoria"],
  [/^(graphics|gráficos|graficos|tarjeta gráfica|tarjeta grafica)$/i, "Gráficos"],
  [/^directx$/i, "DirectX"],
  [/^(network|red|conexión|conexion)$/i, "Red"],
  [/^(storage|almacenamiento|espacio en disco)$/i, "Almacenamiento"],
  [/^(sound card|tarjeta de sonido)$/i, "Sonido"],
  [/^(additional notes|notas adicionales|notas)$/i, "Notas"],
];

function canon(label: string) {
  const trimmed = label.trim();
  const match = CANON.find(([pattern]) => pattern.test(trimmed));
  return match ? match[1] : trimmed;
}

export function parseRequirementBlock(text?: string) {
  const values = new Map<string, string>();
  if (!text?.trim()) {
    return values;
  }
  const stripped = text
    .replace(/^(minimum|mínimo|minimo|recommended|recomendado|máximo|maximo)\s*:?\s*/i, "")
    .replace(/^requires a 64-bit processor and operating system\s*/gim, "")
    .replace(/^requiere un procesador y un sistema operativo de 64 bits\s*/gim, "")
    .trim();
  const splitter =
    /(OS|SO|Processor|Procesador|Memory|Memoria(?: RAM)?|Graphics|Gráficos|Graficos|DirectX|Network|Red|Storage|Almacenamiento|Sound Card|Tarjeta de sonido|Additional Notes|Notas adicionales)\s*:\s*/gi;
  const marks: { label: string; at: number; end: number }[] = [];
  let hit: RegExpExecArray | null;
  while ((hit = splitter.exec(stripped))) {
    marks.push({ label: canon(hit[1]), at: hit.index, end: hit.index + hit[0].length });
  }
  if (!marks.length) {
    return values;
  }
  for (let index = 0; index < marks.length; index += 1) {
    const from = marks[index].end;
    const to = index + 1 < marks.length ? marks[index + 1].at : stripped.length;
    const value = stripped.slice(from, to).trim();
    if (value) {
      values.set(marks[index].label, value);
    }
  }
  return values;
}

export function requirementTable(minimum?: string, recommended?: string): RequirementRow[] {
  const min = parseRequirementBlock(minimum);
  const max = parseRequirementBlock(recommended);
  const labels = [
    ...ORDER.filter((label) => min.has(label) || max.has(label)),
    ...[...min.keys(), ...max.keys()].filter((label) => !ORDER.includes(label)),
  ];
  const unique = [...new Set(labels)];
  return unique.map((label) => ({
    label,
    min: min.get(label) || "—",
    max: max.get(label) || "—",
  }));
}
