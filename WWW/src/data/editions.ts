import type { StoreProduct } from "./catalog";

export type GameEdition = {
  id: string;
  name: string;
  cover: string;
  price: string;
  priceValue: number;
  was?: string;
};

const CLOUD = "https://res.cloudinary.com/fj6z6mba/image/upload";

/** Carátula vertical 2:3 desde Cloudinary */
function portrait(publicId: string) {
  return `${CLOUD}/f_auto,q_auto:best,c_fill,g_auto,ar_2:3,w_480/${publicId}`;
}

function steamLibrary(appId: string) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
}

function moneyFromSample(sample: string, value: number) {
  const formatted = value.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return sample.replace(/[\d.,]+/, formatted);
}

function wasNumber(was?: string) {
  if (!was) return 0;
  return parseFloat(was.replace(/[^0-9.]/g, "")) || 0;
}

/** Precio Ultimate Cyberpunk alineado con Eventos y Ofertas (-80% del tachado). */
export function cyberpunkUltimateDeal(product: StoreProduct) {
  const wasNum = wasNumber(product.was);
  const sale = wasNum ? Math.round(wasNum * 0.2 * 100) / 100 : product.priceValue;
  // Si el API aún trae precio viejo (no es la promo), forzamos el -80%
  const priceValue = wasNum && product.priceValue > wasNum * 0.3 ? sale : product.priceValue;
  const sample = product.was || product.price;
  return {
    priceValue,
    price: moneyFromSample(sample, priceValue),
    was: product.was,
    discountPct: wasNum ? Math.round(((wasNum - priceValue) / wasNum) * 100) : 80,
  };
}

type CoverSet = {
  standard: string;
  mid: string;
  top: string;
  midName?: string;
  topName?: string;
};

const COVERS: Record<string, CoverSet> = {
  "cyberpunk-2077": {
    standard: steamLibrary("1091500"),
    mid: portrait("gamenow/presskit/cp-phl-art"),
    top: portrait("gamenow/presskit/cyberpunk-2077-cover"),
    midName: "Phantom Liberty",
    topName: "Ultimate Edition",
  },
  "arc-raiders": {
    standard: steamLibrary("1808500"),
    mid: portrait("gamenow/presskit/arc-feature"),
    top: portrait("gamenow/presskit/arc-feature-1"),
  },
  "f1-2025-2026-season-pack": {
    standard: "/images/events/f126.webp",
    mid: portrait("gamenow/presskit/f1-shot-1"),
    top: portrait("gamenow/presskit/f1-2025-2026-season-pack-cover"),
  },
  "nba-2k27": {
    standard: "/images/events/nba.webp",
    mid: portrait("gamenow/press/nba-2k27-shot-1"),
    top: portrait("gamenow/press/nba-2k27-cover"),
  },
  "forza-horizon-6": {
    standard: "/images/events/fh6.webp",
    mid: portrait("gamenow/presskit/fh6-shot-2"),
    top: portrait("gamenow/press/forza-horizon-6-cover"),
  },
  "the-last-of-us-2-remastered": {
    standard: "/images/events/lst.webp",
    mid: portrait("gamenow/presskit/tlou-shot-1"),
    top: portrait("gamenow/presskit/the-last-of-us-2-remastered-cover"),
  },
  "007-first-light": {
    standard: "/images/events/007.webp",
    mid: portrait("gamenow/presskit/007-shot-1"),
    top: portrait("gamenow/press/007-first-light-cover"),
  },
  "call-of-duty-modern-warfare-4": {
    standard: "/images/events/mw.webp",
    mid: portrait("gamenow/presskit/mw4-shot-1"),
    top: portrait("gamenow/presskit/mw4-cover"),
  },
};

function coversFor(product: StoreProduct): CoverSet {
  return (
    COVERS[product.slug] ?? {
      standard: product.cover,
      mid: product.cover,
      top: product.cover,
    }
  );
}

export function buildEditions(product: StoreProduct): GameEdition[] {
  const covers = coversFor(product);
  const sample = product.price;
  const base = product.priceValue;

  if (product.slug === "cyberpunk-2077") {
    const ultimate = cyberpunkUltimateDeal(product);
    const wasNum = wasNumber(product.was);
    const standardValue = wasNum ? Math.round(wasNum * 0.4 * 100) / 100 : Math.round(base * 0.75 * 100) / 100;
    const phantomValue = wasNum ? Math.round(wasNum * 0.25 * 100) / 100 : Math.round(base * 0.55 * 100) / 100;
    return [
      {
        id: "standard",
        name: "Edición estándar",
        cover: covers.standard,
        price: moneyFromSample(sample, standardValue),
        priceValue: standardValue,
        was: product.was,
      },
      {
        id: "phantom-liberty",
        name: covers.midName || "Phantom Liberty",
        cover: covers.mid,
        price: moneyFromSample(sample, phantomValue),
        priceValue: phantomValue,
      },
      {
        id: "ultimate",
        name: covers.topName || "Ultimate Edition",
        cover: covers.top,
        price: ultimate.price,
        priceValue: ultimate.priceValue,
        was: ultimate.was,
      },
    ];
  }

  const deluxe = Math.round(base * 1.4 * 100) / 100;
  const ultimate = Math.round(base * 1.75 * 100) / 100;
  return [
    {
      id: "standard",
      name: "Edición estándar",
      cover: covers.standard,
      price: product.price,
      priceValue: base,
      was: product.was,
    },
    {
      id: "deluxe",
      name: covers.midName || "Edición Deluxe",
      cover: covers.mid,
      price: moneyFromSample(sample, deluxe),
      priceValue: deluxe,
    },
    {
      id: "ultimate",
      name: covers.topName || "Edición Ultimate",
      cover: covers.top,
      price: moneyFromSample(sample, ultimate),
      priceValue: ultimate,
    },
  ];
}
