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
  const rtx = name.match(/rtx\s*(\d)(\d{3})/i);
  if (rtx) {
    const gen = Number(rtx[1]);
    const skus: Record<string, number> = { "050": 0, "060": 1, "070": 2, "080": 3, "090": 4, "0 ti": 3 };
    const sku = skus[rtx[2]] ?? Number(rtx[2]) / 100;
    return 20 + gen * 5 + sku;
  }
  const gtx = name.match(/gtx\s*(\d{4})/i);
  if (gtx) {
    return Number(gtx[1]) / 200;
  }
  const rx = name.match(/rx\s*(\d{4})/i);
  if (rx) {
    const code = Number(rx[1]);
    const gen = Math.floor(code / 1000);
    const sku = Math.floor((code % 1000) / 100);
    return 18 + gen * 5 + sku;
  }
  const rxOld = name.match(/rx\s*(\d{3})/i);
  if (rxOld) {
    return Number(rxOld[1]) / 100;
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
