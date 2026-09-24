import { formatMxn } from "./money.js";
import { Trade } from "./models/Trade.js";

export type ResaleQuote = {
  slug: string;
  hours: number;
  listPrice: number;
  listPriceLabel: string;
  hoursPercent: number;
  marketPercent: number;
  payoutPercent: number;
  payout: number;
  payoutLabel: string;
  buys: number;
  sells: number;
  summary: string;
};

/** Porcentaje del precio según horas jugadas. De 50 a 60 h se mantiene el 60%. */
export function hoursPercent(hours: number) {
  const played = Math.max(0, hours);
  if (played < 5) return 100;
  if (played < 20) return 80;
  if (played < 60) return 60;
  if (played <= 100) return 40;
  return 30;
}

export async function marketShift(slug: string) {
  const [buys, sells] = await Promise.all([
    Trade.countDocuments({ slug, kind: "buy" }),
    Trade.countDocuments({ slug, kind: "sell" }),
  ]);
  const total = buys + sells;
  if (!total) return { shift: 0, buys, sells };
  const raw = ((buys - sells) / total) * 10;
  const shift = Math.max(-10, Math.min(10, raw));
  return { shift: Math.round(shift * 10) / 10, buys, sells };
}

export async function purchasePrice(userId: string, slug: string, paidPrice?: number) {
  if (paidPrice && paidPrice > 0) return Math.round(paidPrice * 100) / 100;
  const trade = await Trade.findOne({ userId, slug, kind: "buy", amount: { $gt: 0 } }).sort({ createdAt: -1 });
  const amount = trade?.amount || 0;
  return amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

export async function quoteResale(slug: string, hours: number, paidPrice?: number): Promise<ResaleQuote | null> {
  const listPrice = paidPrice && paidPrice > 0 ? Math.round(paidPrice * 100) / 100 : 0;
  if (!listPrice) return null;
  const base = hoursPercent(hours);
  const market = await marketShift(slug);
  const payoutPercent = Math.max(0, Math.min(100, Math.round((base + market.shift) * 10) / 10));
  const payout = Math.round(listPrice * (payoutPercent / 100) * 100) / 100;
  const marketText =
    market.shift > 0
      ? `Hay más compras que ventas, así que sube ${market.shift}%.`
      : market.shift < 0
        ? `Hay más ventas que compras, así que baja ${Math.abs(market.shift)}%.`
        : "La compra y venta de este juego no mueve el precio.";
  return {
    slug,
    hours,
    listPrice,
    listPriceLabel: formatMxn(listPrice),
    hoursPercent: base,
    marketPercent: market.shift,
    payoutPercent,
    payout,
    payoutLabel: formatMxn(payout),
    buys: market.buys,
    sells: market.sells,
    summary: `Con ${formatHours(hours)} recuperas el ${base}% de lo que pagaste. ${marketText} El ajuste de mercado no pasa de 10%.`,
  };
}

function formatHours(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return rounded === 1 ? "1 hora" : `${rounded} horas`;
}

export function recordTrade(slug: string, kind: "buy" | "sell", userId: string, amount: number) {
  return Trade.create({ slug, kind, userId, amount });
}
