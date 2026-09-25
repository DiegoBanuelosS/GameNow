import { resolve } from "node:path";

const www = resolve(process.cwd(), "../WWW/public");

export type SeedProduct = {
  slug: string;
  name: string;
  studio: string;
  alt: string;
  price: number;
  compareAtPrice?: number;
  sections: { ad: number | null; event: number | null; offer: number | null };
  cover: string;
  studioLogo?: string;
  trailer?: string;
};

export const products: SeedProduct[] = [
  {
    slug: "ace-combat-8",
    name: "Ace Combat 8",
    studio: "Bandai Namco",
    alt: "Anuncio de Ace Combat 8.",
    price: 1299.99,
    sections: { ad: 0, event: null, offer: null },
    cover: resolve(www, "images/ads/acecombat8.webp"),
    studioLogo: resolve(www, "images/ads/studios/bandai-namco.svg"),
    trailer: resolve(www, "videos/ace8.webm"),
  },
  {
    slug: "gta-vi",
    name: "Grand Theft Auto VI",
    studio: "Rockstar Games",
    alt: "Anuncio de Grand Theft Auto VI.",
    price: 1599.99,
    sections: { ad: 1, event: null, offer: null },
    cover: resolve(www, "images/ads/GTAVI.webp"),
    studioLogo: resolve(www, "images/ads/studios/rockstar.svg"),
    trailer: resolve(www, "videos/GTAVI.webm"),
  },
  {
    slug: "ark-2",
    name: "ARK 2",
    studio: "Studio Wildcard",
    alt: "Anuncio de ARK 2.",
    price: 999.99,
    sections: { ad: 2, event: null, offer: null },
    cover: resolve(www, "images/ads/ark2.webp"),
    studioLogo: resolve(www, "images/ads/studios/wildcard.webp"),
    trailer: resolve(www, "videos/ark2.webm"),
  },
  {
    slug: "f1-2025-2026-season-pack",
    name: "F1 2025 - 2026 Season pack",
    studio: "EA Sports",
    alt: "F1 2025 - 2026 Season pack.",
    price: 750.99,
    sections: { ad: null, event: 0, offer: null },
    cover: resolve(www, "images/events/f126.webp"),
    trailer: resolve(www, "videos/F126.webm"),
  },
  {
    slug: "nba-2k27",
    name: "NBA 2K27",
    studio: "2K",
    alt: "NBA 2K27.",
    price: 1009.99,
    sections: { ad: null, event: 1, offer: null },
    cover: resolve(www, "images/events/nba.webp"),
    trailer: resolve(www, "videos/NBA.webm"),
  },
  {
    slug: "forza-horizon-6",
    name: "Forza Horizon 6",
    studio: "Playground Games",
    alt: "Forza Horizon 6.",
    price: 999.99,
    sections: { ad: null, event: 2, offer: null },
    cover: resolve(www, "images/events/fh6.webp"),
    trailer: resolve(www, "videos/FH6.webm"),
  },
  {
    slug: "the-last-of-us-2-remastered",
    name: "The Last of Us 2 Remastered",
    studio: "Naughty Dog",
    alt: "The Last of Us 2 Remastered.",
    price: 644.99,
    compareAtPrice: 1289.99,
    sections: { ad: null, event: null, offer: 1 },
    cover: resolve(www, "images/events/lst.webp"),
    trailer: resolve(www, "videos/lst.webm"),
  },
  {
    slug: "cyberpunk-2077",
    name: "Cyberpunk 2077",
    studio: "CD PROJEKT RED",
    alt: "Cyberpunk 2077.",
    price: 224.99,
    compareAtPrice: 1209.99,
    sections: { ad: null, event: null, offer: 2 },
    cover: resolve(www, "images/events/cp.webp"),
    trailer: resolve(www, "videos/cp.webm"),
  },
  {
    slug: "call-of-duty-modern-warfare-4",
    name: "Call of Duty: Modern Warfare 4",
    studio: "Activision",
    alt: "Call of Duty: Modern Warfare 4.",
    price: 1000.99,
    compareAtPrice: 1299.99,
    sections: { ad: null, event: null, offer: 3 },
    cover: resolve(www, "images/events/mw.webp"),
    trailer: resolve(www, "videos/mw.webm"),
  },
  {
    slug: "arc-raiders",
    name: "Arc Raiders",
    studio: "Embark Studios",
    alt: "Arc Raiders.",
    price: 350.99,
    compareAtPrice: 950.22,
    sections: { ad: null, event: null, offer: 4 },
    cover: resolve(www, "images/events/arc.webp"),
  },
  {
    slug: "007-first-light",
    name: "007 First Light",
    studio: "IO Interactive",
    alt: "007 First Light.",
    price: 799.99,
    compareAtPrice: 1599.99,
    sections: { ad: null, event: null, offer: 5 },
    cover: resolve(www, "images/events/007.webp"),
    trailer: resolve(www, "videos/007.webm"),
  },
];

export const siteAssets = {
  authPanel: resolve(www, "images/auth-panel.webp"),
};
