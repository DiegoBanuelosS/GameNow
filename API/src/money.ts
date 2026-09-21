import { cacheGet, cacheSet } from "./cache.js";

const FALLBACK_USD_MXN = 18;
let inFlightRate: Promise<number> | null = null;

export function formatMxn(value: number) {
  const amount = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `$${amount} MXN`;
}

export async function usdMxnRate(): Promise<number> {
  const cached = cacheGet<number>("usd-mxn");
  if (cached) {
    return cached;
  }
  if (inFlightRate) {
    return inFlightRate;
  }

  inFlightRate = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch("https://open.er-api.com/v6/latest/USD", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      const data = (await response.json()) as { rates?: { MXN?: number } };
      const rate = data.rates?.MXN;
      if (!rate || typeof rate !== "number") {
        throw new Error("sin MXN");
      }
      return cacheSet("usd-mxn", rate, 60 * 60 * 1000);
    } catch {
      return cacheSet("usd-mxn", FALLBACK_USD_MXN, 5 * 60 * 1000);
    } finally {
      inFlightRate = null;
    }
  })();

  return inFlightRate;
}

export async function toMxn(amount: number, currency = "USD") {
  if (!amount) {
    return 0;
  }
  if (currency === "MXN") {
    return amount;
  }
  const rate = await usdMxnRate();
  return Math.round(amount * rate * 100) / 100;
}

