export type PcProfile = {
  os?: string;
  cpu?: string;
  gpu?: string;
  ramGb?: number | null;
};

export async function readPcProfile(): Promise<PcProfile> {
  const gpu = readGpu();
  const ramGb =
    typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : null;
  const os = await readWindows();
  return { os, gpu, ramGb, cpu: "" };
}

function readGpu() {
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
