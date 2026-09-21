export type PcProfile = {
  os?: string;
  cpu?: string;
  gpu?: string;
  ramGb?: number | null;
};

export type RequirementRow = {
  label: string;
  min: string;
  max: string;
};

export type PcFit = {
  verdict: "well" | "poor" | "no" | "unknown";
  title: string;
  detail: string;
  machine: string;
};

const EMPTY = /^(—|-|n\/a|na|tbd|por confirmar|no publicado|sin publicar)?$/i;

function unpublished(value?: string) {
  return !value || EMPTY.test(value.trim());
}

function row(table: RequirementRow[], label: string) {
  return table.find((item) => item.label.toLowerCase() === label.toLowerCase());
}

function ramGb(text?: string) {
  if (!text || unpublished(text)) {
    return null;
  }
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*GB/i);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function windowsRank(text?: string) {
  if (!text) {
    return null;
  }
  if (/windows\s*11/i.test(text) && /windows\s*10/i.test(text)) {
    return 10;
  }
  if (/windows\s*11/i.test(text)) {
    return 11;
  }
  if (/windows\s*10/i.test(text)) {
    return 10;
  }
  return null;
}

function gpuScore(name?: string) {
  if (!name || unpublished(name)) {
    return null;
  }
  const n = name.toLowerCase();

  // RTX 40xx series  (90-100)
  if (/rtx\s*4090/.test(n)) return 100;
  if (/rtx\s*4080/.test(n)) return 96;
  if (/rtx\s*4070\s*ti/.test(n)) return 94;
  if (/rtx\s*4070/.test(n)) return 90;
  if (/rtx\s*4060\s*ti/.test(n)) return 86;
  if (/rtx\s*4060/.test(n)) return 82;
  if (/rtx\s*4050/.test(n)) return 76;

  // RTX 30xx series  (74-88)
  if (/rtx\s*3090/.test(n)) return 95;
  if (/rtx\s*3080\s*ti/.test(n)) return 91;
  if (/rtx\s*3080/.test(n)) return 88;
  if (/rtx\s*3070\s*ti/.test(n)) return 82;
  if (/rtx\s*3070/.test(n)) return 79;
  if (/rtx\s*3060\s*ti/.test(n)) return 77;
  if (/rtx\s*3060/.test(n)) return 74;
  if (/rtx\s*3050/.test(n)) return 66;

  // RTX 20xx series  (60-78)
  if (/rtx\s*2080\s*ti/.test(n)) return 83;
  if (/rtx\s*2080/.test(n)) return 78;
  if (/rtx\s*2070/.test(n)) return 74;
  if (/rtx\s*2060/.test(n)) return 68;

  // GTX 16xx / 10xx series  (35-60)
  if (/gtx\s*1080\s*ti/.test(n)) return 70;
  if (/gtx\s*1080/.test(n)) return 64;
  if (/gtx\s*1070\s*ti/.test(n)) return 61;
  if (/gtx\s*1070/.test(n)) return 58;
  if (/gtx\s*1660\s*super/.test(n)) return 56;
  if (/gtx\s*1660\s*ti/.test(n)) return 55;
  if (/gtx\s*1660/.test(n)) return 52;
  if (/gtx\s*1650\s*super/.test(n)) return 48;
  if (/gtx\s*1650/.test(n)) return 44;
  if (/gtx\s*1060/.test(n)) return 45;
  if (/gtx\s*1050\s*ti/.test(n)) return 36;
  if (/gtx\s*1050/.test(n)) return 32;

  // AMD RDNA3 RX 7xxx  (80-98)
  if (/rx\s*7900\s*xtx/.test(n)) return 98;
  if (/rx\s*7900\s*xt/.test(n)) return 93;
  if (/rx\s*7800\s*xt/.test(n)) return 82;
  if (/rx\s*7700\s*xt/.test(n)) return 76;
  if (/rx\s*7600/.test(n)) return 68;

  // AMD RDNA2 RX 6xxx  (58-88)
  if (/rx\s*6950\s*xt/.test(n)) return 92;
  if (/rx\s*6900\s*xt/.test(n)) return 88;
  if (/rx\s*6800\s*xt/.test(n)) return 84;
  if (/rx\s*6800/.test(n)) return 80;
  if (/rx\s*6750\s*xt/.test(n)) return 76;
  if (/rx\s*6700\s*xt/.test(n)) return 74;
  if (/rx\s*6700/.test(n)) return 70;
  if (/rx\s*6650\s*xt/.test(n)) return 68;
  if (/rx\s*6600\s*xt/.test(n)) return 66;
  if (/rx\s*6600/.test(n)) return 65;
  if (/rx\s*6500\s*xt/.test(n)) return 50;

  // AMD RX 5xxx (RDNA1)
  if (/rx\s*5700\s*xt/.test(n)) return 70;
  if (/rx\s*5700/.test(n)) return 67;
  if (/rx\s*5600\s*xt/.test(n)) return 62;
  if (/rx\s*5500\s*xt/.test(n)) return 54;

  // AMD older (Vega / Polaris)
  if (/vega\s*64/.test(n)) return 60;
  if (/vega\s*56/.test(n)) return 56;
  if (/rx\s*590/.test(n)) return 46;
  if (/rx\s*580/.test(n)) return 44;
  if (/rx\s*570/.test(n)) return 40;
  if (/rx\s*480/.test(n)) return 43;

  // Generic RTX/GTX/RX fallback (won't usually reach here with specific matches above)
  const rtx = name.match(/rtx\s*(\d)(\d{3})/i);
  if (rtx) {
    const gen = Number(rtx[1]);
    const sku = Number(rtx[2]);
    return 60 + gen * 6 + Math.floor(sku / 100) * 2;
  }
  const gtx = name.match(/gtx\s*(\d{4})/i);
  if (gtx) {
    return 30 + Math.floor(Number(gtx[1]) / 100);
  }
  const rx = name.match(/rx\s*(\d{4})/i);
  if (rx) {
    return 50 + Math.floor((Number(rx[1]) % 1000) / 100) * 3;
  }
  return null;
}

function gpuOptions(text?: string) {
  if (!text || unpublished(text)) {
    return [];
  }
  return text
    .split(/\/|,| o | or /i)
    .map((part) => gpuScore(part))
    .filter((score): score is number => score != null);
}

function intelScore(name: string) {
  const match = name.match(/i([3579])[^\d]*(\d{4,5})/i);
  if (!match) {
    return null;
  }
  const family = Number(match[1]);
  const model = match[2];
  const gen = model.length === 5 ? Number(model.slice(0, 2)) : Number(model.slice(0, 1));
  return family * 1000 + gen * 10;
}

function ryzenScore(name: string) {
  const match = name.match(/ryzen\s*([3579])\s*(\d{4})/i);
  if (!match) {
    return null;
  }
  const family = Number(match[1]);
  const gen = Number(match[2][0]);
  return family * 1000 + gen * 10;
}

function cpuScore(name?: string) {
  if (!name || unpublished(name)) {
    return null;
  }
  return intelScore(name) ?? ryzenScore(name);
}

function cpuOptions(text?: string) {
  if (!text || unpublished(text)) {
    return [];
  }
  return text
    .split(/\/|,| o | or /i)
    .map((part) => cpuScore(part))
    .filter((score): score is number => score != null);
}

function meetsOr(user: number | null, options: number[]) {
  if (user == null || !options.length) {
    return null;
  }
  return user >= Math.min(...options);
}

function machineLine(pc: PcProfile) {
  const parts = [pc.os, pc.cpu, pc.gpu, pc.ramGb ? `${pc.ramGb} GB RAM` : ""]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : "No pudimos leer tu equipo.";
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

  const os = row(table, "SO");
  const cpu = row(table, "Procesador");
  const ram = row(table, "Memoria");
  const gpu = row(table, "Gráficos");

  const checks: { passMin: boolean | null; passMax: boolean | null }[] = [];

  const userOs = windowsRank(pc.os);
  const minOs = windowsRank(os?.min);
  const maxOs = windowsRank(os?.max);
  if (userOs != null && minOs != null) {
    checks.push({
      passMin: userOs >= minOs,
      passMax: maxOs == null ? null : userOs >= maxOs,
    });
  }

  const userCpu = cpuScore(pc.cpu);
  const minCpu = cpuOptions(cpu?.min);
  const maxCpu = cpuOptions(cpu?.max);
  if (userCpu != null && minCpu.length) {
    checks.push({
      passMin: meetsOr(userCpu, minCpu),
      passMax: maxCpu.length ? meetsOr(userCpu, maxCpu) : null,
    });
  }

  const userRam = pc.ramGb ?? null;
  const minRam = ramGb(ram?.min);
  const maxRam = ramGb(ram?.max);
  if (userRam != null && minRam != null) {
    checks.push({
      passMin: userRam >= minRam,
      passMax: maxRam == null ? null : userRam >= maxRam,
    });
  }

  const userGpu = gpuScore(pc.gpu);
  const minGpu = gpuOptions(gpu?.min);
  const maxGpu = gpuOptions(gpu?.max);
  if (userGpu != null && minGpu.length) {
    checks.push({
      passMin: meetsOr(userGpu, minGpu),
      passMax: maxGpu.length ? meetsOr(userGpu, maxGpu) : null,
    });
  }

  const compared = checks.filter((item) => item.passMin != null);
  if (!compared.length) {
    return {
      verdict: "unknown",
      title: "No se puede comprobar",
      detail:
        "Faltan datos de tu PC o la ficha no trae cifras comparables (CPU, GPU, RAM o Windows).",
      machine,
    };
  }

  if (compared.some((item) => item.passMin === false)) {
    return {
      verdict: "no",
      title: "No corre",
      detail: "Tu PC queda por debajo de los mínimos publicados. No es una prueba real, solo una lectura de la ficha.",
      machine,
    };
  }

  const maxChecks = compared.filter((item) => item.passMax != null);
  if (maxChecks.length && maxChecks.every((item) => item.passMax === true)) {
    return {
      verdict: "well",
      title: "Corre bien",
      detail: "Tu PC llega a los máximos publicados. El rendimiento real depende del juego y de los ajustes.",
      machine,
    };
  }

  if (maxChecks.length && maxChecks.some((item) => item.passMax === false)) {
    return {
      verdict: "poor",
      title: "Corre, pero mal",
      detail: "Llegas a los mínimos, no a los máximos. Espéralo justo, a baja calidad o a pocos fotogramas.",
      machine,
    };
  }

  return {
    verdict: "well",
    title: "Corre",
    detail: "Llegas a los mínimos publicados. Los máximos no están publicados o no se pudieron comparar.",
    machine,
  };
}
