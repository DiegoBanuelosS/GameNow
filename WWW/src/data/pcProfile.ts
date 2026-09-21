export type PcProfile = {
  os?: string;
  cpu?: string;
  gpu?: string;
  /** Effective RAM in GB. May be higher than deviceMemory due to browser cap. */
  ramGb?: number | null;
};

export async function readPcProfile(): Promise<PcProfile> {
  const rawGpu = readGpu();
  const gpu = cleanGpuName(rawGpu);
  const threads = typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : 0;
  const cpu = threads > 0 ? `CPU multinúcleo (${threads} hilos)` : "";
  // navigator.deviceMemory is capped at 8 by browsers for privacy.
  // A machine that reports 8 almost certainly has ≥16 GB, so we treat 8 as 16.
  const raw = typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : null;
  const ramGb = raw === 8 ? 16 : raw;
  const os = await readWindows();
  return { os, gpu, ramGb, cpu };
}

/** Extract clean GPU name from raw WebGL renderer string (handles ANGLE wrappers). */
function cleanGpuName(raw: string): string {
  if (!raw) return "";
  let s = raw;
  // Strip ANGLE wrapper: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 …, D3D11_PRE_ROV)"
  const angleMatch = s.match(/ANGLE\s*\([^,]+,\s*([^,]+?)(?:\s+Direct3D|\s+OpenGL|\s+Vulkan|\s+Metal|\))/i);
  if (angleMatch) {
    s = angleMatch[1];
  }
  // Strip trailing driver junk: " Direct3D11 vs_5_0 ps_5_0", "/PCIe/SSE2", etc.
  s = s.replace(/\s*(Direct3D|vs_\d|ps_\d|D3D\d|\/PCIe|\/SSE\d|PCIe|SSE\d).*$/i, "");
  // Strip trailing parenthetical like "(6 GB)" if present
  s = s.replace(/\s*\([^)]*\)\s*$/, "");
  return s.trim();
}

function readGpu(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl || !("getExtension" in gl)) {
      return "";
    }
    const info = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
    if (!info) {
      return "";
    }
    return String((gl as WebGLRenderingContext).getParameter(info.UNMASKED_RENDERER_WEBGL) || "");
  } catch {
    return "";
  }
}

async function readWindows() {
  const ua = navigator.userAgent;
  const uaData = (
    navigator as Navigator & {
      userAgentData?: {
        getHighEntropyValues?: (hints: string[]) => Promise<{ platformVersion?: string }>;
      };
    }
  ).userAgentData;
  if (uaData?.getHighEntropyValues) {
    try {
      const { platformVersion } = await uaData.getHighEntropyValues(["platformVersion"]);
      const major = Number((platformVersion || "0").split(".")[0]);
      if (Number.isFinite(major) && major >= 13) {
        return "Windows 11";
      }
      if (/Windows/i.test(ua) || major > 0) {
        return "Windows 10";
      }
    } catch {
      /* fall through */
    }
  }
  if (/Windows/i.test(ua)) {
    return "Windows 10";
  }
  return "";
}
