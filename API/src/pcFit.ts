export type PcProfile = {
  os?: string;
  cpu?: string;
  gpu?: string;
  ramGb?: number | null;
  /** Alto nativo del monitor en píxeles (1080, 1440, 2160…). */
  screenHeight?: number | null;
};

export type RequirementRow = {
  label: string;
  min: string;
  max: string;
};

export type Quality = "Bajo" | "Medio" | "Alto" | "Ultra";
export type Resolution = "1080p" | "1440p" | "4K";

export type PcFit = {
  verdict: "great" | "well" | "poor" | "no" | "unknown";
  title: string;
  detail: string;
  machine: string;
  fps?: { min: number; max: number };
  quality?: Quality;
  resolution?: Resolution;
  presets?: { quality: Quality; fps: number }[];
  limitedBy?: "gpu" | "cpu";
  notes?: string[];
};

const EMPTY = /^(—|-|n\/a|na|tbd|por confirmar|no publicado|sin publicar)?$/i;

/** Costo relativo de cada preset frente a Bajo (más costo = menos FPS). */
const PRESETS: { quality: Quality; cost: number }[] = [
  { quality: "Bajo", cost: 1 },
  { quality: "Medio", cost: 1.2 },
  { quality: "Alto", cost: 1.45 },
  { quality: "Ultra", cost: 1.8 },
];

const RESOLUTIONS: { name: Resolution; height: number; cost: number }[] = [
  { name: "4K", height: 2160, cost: 2.6 },
  { name: "1440p", height: 1440, cost: 1.55 },
  { name: "1080p", height: 1080, cost: 1 },
];

/** Las fichas son conservadoras: el mínimo rinde ~45 FPS en Bajo y el recomendado ~70 FPS en Alto (1080p). */
const MIN_SPEC_LOW_FPS = 48;
const REC_SPEC_HIGH_FPS = 72;
const MIN_SPEC_CPU_FPS = 60;
const REC_SPEC_CPU_FPS = 100;
const CPU_STEP = 1.1;
/** Cada GPU_DOUBLING puntos de GPU ≈ el doble de rendimiento. */
const GPU_DOUBLING = 20;
const TARGET_FPS = 60;

function unpublished(value?: string) {
  return !value || EMPTY.test(value.trim());
}

function row(table: RequirementRow[], label: string) {
  return table.find((item) => item.label.toLowerCase() === label.toLowerCase());
}

function ramGb(text?: string) {
  if (!text || unpublished(text)) return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*GB/i);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function windowsRank(text?: string) {
  if (!text) return null;
  if (/windows\s*11/i.test(text) && /windows\s*10/i.test(text)) return 10;
  if (/windows\s*11/i.test(text)) return 11;
  if (/windows\s*10/i.test(text)) return 10;
  if (/windows/i.test(text)) return 7;
  return null;
}

const GPU_TABLE: [RegExp, number][] = [
  [/rtx\s*5090/, 112],
  [/rtx\s*5080/, 103],
  [/rtx\s*5070\s*ti/, 99],
  [/rtx\s*5070/, 93],
  [/rtx\s*5060\s*ti/, 87],
  [/rtx\s*5060/, 83],
  [/rtx\s*4090/, 104],
  [/rtx\s*4080/, 97],
  [/rtx\s*4070\s*ti/, 93],
  [/rtx\s*4070/, 88],
  [/rtx\s*4060\s*ti/, 81],
  [/rtx\s*4060/, 77],
  [/rtx\s*4050/, 70],
  [/rtx\s*3090/, 91],
  [/rtx\s*3080\s*ti/, 89],
  [/rtx\s*3080/, 86],
  [/rtx\s*3070\s*ti/, 81],
  [/rtx\s*3070/, 79],
  [/rtx\s*3060\s*ti/, 76],
  [/rtx\s*3060/, 70],
  [/rtx\s*3050/, 60],
  [/rtx\s*2080\s*ti/, 81],
  [/rtx\s*2080/, 75],
  [/rtx\s*2070/, 71],
  [/rtx\s*2060/, 65],
  [/gtx\s*1080\s*ti/, 70],
  [/gtx\s*1080/, 64],
  [/gtx\s*1070\s*ti/, 61],
  [/gtx\s*1070/, 58],
  [/gtx\s*1660\s*(super|ti)/, 55],
  [/gtx\s*1660/, 52],
  [/gtx\s*1650\s*super/, 48],
  [/gtx\s*1650/, 42],
  [/gtx\s*1060/, 45],
  [/gtx\s*1050\s*ti/, 34],
  [/gtx\s*1050/, 30],
  [/gtx\s*980\s*ti/, 50],
  [/gtx\s*980/, 44],
  [/gtx\s*970/, 40],
  [/gtx\s*960/, 30],
  [/gtx\s*950/, 25],
  [/gtx\s*750\s*ti/, 18],
  [/rx\s*9070\s*xt/, 97],
  [/rx\s*9070/, 92],
  [/rx\s*9060\s*xt/, 80],
  [/rx\s*7900\s*xtx/, 99],
  [/rx\s*7900\s*xt/, 94],
  [/rx\s*7900\s*gre/, 88],
  [/rx\s*7800\s*xt/, 86],
  [/rx\s*7700\s*xt/, 80],
  [/rx\s*7600\s*xt/, 72],
  [/rx\s*7600/, 70],
  [/rx\s*6950\s*xt/, 91],
  [/rx\s*6900\s*xt/, 89],
  [/rx\s*6800\s*xt/, 86],
  [/rx\s*6800/, 81],
  [/rx\s*6750\s*xt/, 76],
  [/rx\s*6700\s*xt/, 74],
  [/rx\s*6700/, 71],
  [/rx\s*6650\s*xt/, 69],
  [/rx\s*6600\s*xt/, 68],
  [/rx\s*6600/, 65],
  [/rx\s*6500\s*xt/, 44],
  [/rx\s*5700\s*xt/, 67],
  [/rx\s*5700/, 64],
  [/rx\s*5600\s*xt/, 60],
  [/rx\s*5500\s*xt/, 50],
  [/vega\s*64/, 56],
  [/vega\s*56/, 52],
  [/rx\s*590/, 47],
  [/rx\s*580/, 44],
  [/rx\s*570/, 40],
  [/rx\s*480/, 43],
  [/rx\s*470/, 38],
  [/r9\s*390/, 40],
  [/r9\s*290/, 36],
  [/arc\s*b580/, 72],
  [/arc\s*b570/, 67],
  [/arc\s*a770/, 68],
  [/arc\s*a750/, 65],
  [/arc\s*a580/, 60],
  [/arc\s*a380/, 36],
  [/radeon\s*890m/, 44],
  [/radeon\s*780m/, 40],
  [/radeon\s*760m/, 34],
  [/radeon\s*680m/, 34],
  [/radeon\s*660m/, 26],
  [/iris\s*xe|intel\s*arc\s*graphics/, 22],
  [/vega\s*(8|10|11)\b/, 14],
  [/radeon(\(tm\))?\s*graphics/, 18],
  [/uhd\s*graphics|hd\s*graphics/, 2],
  [/apple\s*m\d\s*max/, 62],
  [/apple\s*m\d\s*pro/, 46],
  [/apple\s*m[34]/, 36],
  [/apple\s*m[12]/, 28],
];

function plain(name: string) {
  return name.toLowerCase().replace(/\((r|tm)\)|®|™/g, "").replace(/\s+/g, " ");
}

function gpuScore(name?: string) {
  if (!name || unpublished(name)) return null;
  const n = plain(name);
  if (/basic render|swiftshader|llvmpipe/.test(n)) return null;
  const laptop = /laptop|mobile|max-q/.test(n) ? 8 : 0;
  for (const [pattern, score] of GPU_TABLE) {
    if (pattern.test(n)) return score - laptop;
  }
  const rtx = n.match(/rtx\s*(\d)0(\d)0/);
  if (rtx) return 50 + Number(rtx[1]) * 6 + Number(rtx[2]) * 3 - laptop;
  const gtx = n.match(/gtx\s*(\d{3,4})/);
  if (gtx) return 25 - laptop;
  return null;
}

/** Índice de CPU ≈ generación Intel equivalente + gama. */
function cpuIndex(name?: string) {
  if (!name || unpublished(name)) return null;
  const n = plain(name);
  const suffix = (text: string) => (/\d(k|kf|ks|x)\b/.test(text) ? 0.5 : /\d(u|y)\b/.test(text) ? -2 : 0);

  const ultra = n.match(/core\s*ultra\s*([579])\s*(\d)/);
  if (ultra) return 14.5 + ({ 5: 0, 7: 1.5, 9: 2.5 } as Record<string, number>)[ultra[1]] + (ultra[2] === "2" ? 1 : 0);

  const intel = n.match(/i([3579])[\s-]*(\d{4,5})([a-z]*)/);
  if (intel) {
    const model = intel[2];
    const gen = model.length === 5 ? Number(model.slice(0, 2)) : Number(model[0]);
    const tier = ({ 3: -3, 5: 0, 7: 1.5, 9: 2.5 } as Record<string, number>)[intel[1]];
    return gen + tier + suffix(`${model}${intel[3]}`);
  }

  const ryzen = n.match(/ryzen\s*([3579])\s*(?:pro\s*)?(\d)(\d{3})([a-z0-9]*)/);
  if (ryzen) {
    const series = Number(ryzen[2]);
    const base = ({ 1: 7.5, 2: 8.5, 3: 10.5, 4: 10.5, 5: 12.5, 6: 13, 7: 14.5, 8: 14, 9: 15.5 } as Record<number, number>)[series] ?? 10;
    const tier = ({ 3: -3, 5: 0, 7: 1.5, 9: 2.5 } as Record<string, number>)[ryzen[1]];
    const x3d = /x3d/.test(ryzen[4]) ? 1.5 : 0;
    return base + tier + x3d + suffix(`${ryzen[3]}${ryzen[4]}`);
  }

  if (/fx[\s-]*\d{4}/.test(n)) return 4;
  if (/core\s*2|phenom|athlon/.test(n)) return 2;
  if (/apple\s*m\d/.test(n)) return 14;
  return null;
}

/** El navegador solo expone hilos; lo usamos como aproximación gruesa. */
function threadIndex(name?: string) {
  const match = name?.match(/\((\d+)\s*hilos\)/);
  if (!match) return null;
  const threads = Number(match[1]);
  if (threads >= 20) return 14;
  if (threads >= 16) return 12.5;
  if (threads >= 12) return 11;
  if (threads >= 8) return 9;
  if (threads >= 6) return 7;
  return 4;
}

function options<T>(text: string | undefined, read: (part: string) => T | null) {
  if (!text || unpublished(text)) return [];
  return text
    .split(/\/|,| o | or /i)
    .map((part) => read(part))
    .filter((value): value is T => value != null);
}

function lowest(values: number[]) {
  return values.length ? Math.min(...values) : null;
}

function geoMean(values: number[]) {
  return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
}

function machineLine(pc: PcProfile) {
  const parts = [pc.os, pc.cpu, pc.gpu, pc.ramGb ? `${pc.ramGb} GB RAM` : ""]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : "No pudimos leer tu equipo.";
}

function fpsRange(fps: number) {
  const round = (value: number) => Math.max(5, Math.round(value / 5) * 5);
  return { min: round(fps * 0.88), max: round(fps * 1.12) };
}

function nativeResolution(height?: number | null) {
  if (!height) return RESOLUTIONS[2];
  return RESOLUTIONS.find((item) => height >= item.height * 0.95) ?? RESOLUTIONS[2];
}

export function fitPc(table: RequirementRow[] | undefined, pc: PcProfile): PcFit {
  const machine = machineLine(pc);
  if (!table?.length) {
    return {
      verdict: "unknown",
      title: "No se puede comprobar",
      detail: "Este título no tiene requisitos de PC publicados.",
      machine,
    };
  }

  const notes: string[] = [];
  const gpuReq = row(table, "Gráficos");
  const userGpu = gpuScore(pc.gpu);
  const minGpu = lowest(options(gpuReq?.min, gpuScore));
  const recGpu = lowest(options(gpuReq?.max, gpuScore));

  if (userGpu == null) {
    return {
      verdict: "unknown",
      title: "No se puede comprobar",
      detail: "No pudimos identificar tu tarjeta gráfica, así que no podemos estimar los FPS.",
      machine,
    };
  }
  if (minGpu == null && recGpu == null) {
    return {
      verdict: "unknown",
      title: "No se puede comprobar",
      detail: "La ficha no trae tarjetas gráficas que podamos comparar con la tuya.",
      machine,
    };
  }

  const perf = (score: number) => 2 ** (score / GPU_DOUBLING);
  const lowEstimates: number[] = [];
  if (minGpu != null) lowEstimates.push(MIN_SPEC_LOW_FPS * (perf(userGpu) / perf(minGpu)));
  if (recGpu != null) {
    const highCost = PRESETS.find((item) => item.quality === "Alto")!.cost;
    lowEstimates.push(REC_SPEC_HIGH_FPS * highCost * (perf(userGpu) / perf(recGpu)));
  }
  let lowFps = geoMean(lowEstimates);

  const cpuReq = row(table, "Procesador");
  const exactCpu = cpuIndex(pc.cpu);
  const userCpu = exactCpu ?? threadIndex(pc.cpu);
  const minCpu = lowest(options(cpuReq?.min, cpuIndex));
  const recCpu = lowest(options(cpuReq?.max, cpuIndex));
  let cpuCap = Infinity;
  if (userCpu != null && (minCpu != null || recCpu != null)) {
    const caps: number[] = [];
    if (minCpu != null) caps.push(MIN_SPEC_CPU_FPS * CPU_STEP ** (userCpu - minCpu));
    if (recCpu != null) caps.push(REC_SPEC_CPU_FPS * CPU_STEP ** (userCpu - recCpu));
    cpuCap = geoMean(caps);
    if (exactCpu == null) notes.push("No pudimos leer el modelo de tu procesador; lo estimamos por sus núcleos.");
  }

  const ramReq = row(table, "Memoria");
  const minRam = ramGb(ramReq?.min);
  const recRam = ramGb(ramReq?.max);
  const userRam = pc.ramGb ?? null;
  if (userRam != null && minRam != null && userRam < minRam) {
    if (userRam < minRam * 0.5) {
      return {
        verdict: "no",
        title: "No corre",
        detail: `El juego pide al menos ${minRam} GB de RAM y tu PC tiene ${userRam} GB. Con tan poca memoria no arranca o se traba constantemente.`,
        machine,
        notes,
      };
    }
    const penalty = userRam < minRam * 0.75 ? 0.75 : 0.88;
    lowFps *= penalty;
    cpuCap *= penalty;
    notes.push(`Tienes ${userRam} GB de RAM y el mínimo es ${minRam} GB: espera tirones al cargar zonas nuevas.`);
  } else if (userRam != null && recRam != null && userRam < recRam) {
    notes.push(`Con ${recRam} GB de RAM tendrías cargas más rápidas y menos tirones.`);
  }

  const osReq = row(table, "SO");
  const userOs = windowsRank(pc.os);
  const minOs = windowsRank(osReq?.min);
  if (!userOs && pc.os) {
    notes.push("Este juego es para Windows; en tu sistema necesitarías una capa de compatibilidad.");
  } else if (userOs != null && minOs != null && userOs < minOs) {
    notes.push(`El juego pide Windows ${minOs}; actualiza tu sistema para poder instalarlo.`);
  }

  const fpsAt = (resolutionCost: number, presetCost: number) => Math.min(lowFps / (resolutionCost * presetCost), cpuCap);
  const native = nativeResolution(pc.screenHeight);
  const candidates = RESOLUTIONS.filter((item) => item.height <= native.height);

  let pick: { resolution: (typeof RESOLUTIONS)[number]; preset: (typeof PRESETS)[number] } | null = null;
  for (const resolution of candidates) {
    const allowed = resolution.name === "1080p" ? PRESETS : PRESETS.filter((item) => item.quality !== "Bajo");
    const best = [...allowed].reverse().find((preset) => fpsAt(resolution.cost, preset.cost) >= TARGET_FPS);
    if (best) {
      pick = { resolution, preset: best };
      break;
    }
  }
  if (!pick) {
    const base = RESOLUTIONS[2];
    const playable = [...PRESETS].reverse().find((preset) => fpsAt(base.cost, preset.cost) >= 40);
    pick = { resolution: base, preset: playable ?? PRESETS[0] };
  }

  const fps = fpsAt(pick.resolution.cost, pick.preset.cost);
  const gpuFps = lowFps / (pick.resolution.cost * pick.preset.cost);
  const limitedBy = cpuCap < gpuFps ? "cpu" : "gpu";
  const range = fpsRange(fps);
  const presets = PRESETS.map((preset) => ({
    quality: preset.quality,
    fps: Math.round(fpsAt(pick!.resolution.cost, preset.cost)),
  }));
  const label = `${pick.preset.quality} a ${pick.resolution.name}`;
  const fpsText = fps > 144 ? "más de 144 FPS" : `${range.min}–${range.max} FPS`;

  if (limitedBy === "cpu" && fps < TARGET_FPS) {
    notes.push("Tu procesador es el que limita los FPS; bajar gráficos no ayudará mucho.");
  }

  const base = { machine, fps: range, quality: pick.preset.quality, resolution: pick.resolution.name, presets, limitedBy, notes } as const;

  if (fps < 20) {
    return {
      ...base,
      verdict: "no",
      title: "No corre",
      detail: `Aun en Bajo a 1080p calculamos unos ${Math.round(fps)} FPS. Tu equipo está muy por debajo de lo que pide el juego.`,
    };
  }
  if (fps < 30) {
    return {
      ...base,
      verdict: "poor",
      title: "Corre justo",
      detail: `Espera ${fpsText} en ${label}. Arranca, pero no se sentirá fluido; activa el escalado (DLSS/FSR) si el juego lo tiene.`,
    };
  }
  const great = fps >= TARGET_FPS && (pick.preset.quality === "Alto" || pick.preset.quality === "Ultra");
  return {
    ...base,
    verdict: great ? "great" : "well",
    title: great ? "Corre muy bien" : "Corre bien",
    detail:
      fps >= TARGET_FPS
        ? `Espera ${fpsText} en ${label}.`
        : `Espera ${fpsText} en ${label}. Es jugable y estable; para llegar a 60 FPS usa el escalado (DLSS/FSR).`,
  };
}
