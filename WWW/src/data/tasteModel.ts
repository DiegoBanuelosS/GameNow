export type TasteExample = {
  genre: string;
  playTimeHours?: number;
  isFavorite?: boolean;
  userRating?: number;
  purchased?: boolean;
  steamAppId?: string;
  name?: string;
  lastPlayedTimestamp?: number;
};

const CATEGORIES = ["Acción", "Aventura", "RPG", "Shooter", "Estrategia", "Indie", "Simulación", "Deportes"] as const;

const EXCEPTIONS = new Set(["431960"]);
const EXCEPTION_NAME = /wallpaper engine/i;

export function isTasteException(game: TasteExample) {
  return EXCEPTIONS.has(game.steamAppId || "") || EXCEPTION_NAME.test(game.name || "");
}

export type TasteCategory = (typeof CATEGORIES)[number];

const RULES: { category: TasteCategory; pattern: RegExp }[] = [
  { category: "Shooter", pattern: /shooter|dispar|fps/i },
  { category: "RPG", pattern: /\brpg\b|rol/i },
  { category: "Estrategia", pattern: /estrateg/i },
  { category: "Deportes", pattern: /deport|carrer|sport/i },
  { category: "Simulación", pattern: /simul/i },
  { category: "Aventura", pattern: /aventur/i },
  { category: "Acción", pattern: /acci[oó]n|\baction\b/i },
  { category: "Indie", pattern: /indie/i },
];

export function categoriesFrom(labels: string[]): TasteCategory[] {
  const text = labels.filter(Boolean).join(" ");
  return RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.category);
}

/** Maximum-likelihood categorical model. Each owned game updates the category weights. */
export function learnTaste(games: TasteExample[]) {
  const weights = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<TasteCategory, number>;
  let samples = 0;
  for (const game of games) {
    if (game.purchased === false || isTasteException(game)) continue;
    const categories = categoriesFrom([game.genre]);
    if (!categories.length) continue;
    const hours = Math.max(game.playTimeHours || 0, 0.25);
    const favorite = game.isFavorite ? 1.6 : 1;
    const rating = game.userRating ? 0.6 + game.userRating / 5 : 1;
    const step = hours * favorite * rating;
    for (const category of categories) {
      weights[category] += step;
    }
    samples += 1;
  }
  return { weights, samples };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function mostPlayedThisWeek<T extends TasteExample>(games: T[], now = Date.now()) {
  const weekAgo = now - WEEK_MS;
  return (
    games
      .filter((game) => {
        if (game.purchased === false || isTasteException(game)) return false;
        let played = game.lastPlayedTimestamp || 0;
        if (played > 0 && played < 1e12) played *= 1000;
        return played >= weekAgo && (game.playTimeHours || 0) > 0;
      })
      .sort((a, b) => (b.playTimeHours || 0) - (a.playTimeHours || 0))[0] ?? null
  );
}

export function predictScore(labels: string[], weights: Record<TasteCategory, number>) {
  const categories = categoriesFrom(labels);
  const total = CATEGORIES.reduce((sum, category) => sum + weights[category], 0);
  if (!categories.length || total <= 0) return 0;
  const mass = categories.reduce((sum, category) => sum + weights[category], 0);
  return mass / (total * categories.length);
}
