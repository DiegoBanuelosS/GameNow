import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type Review = {
  id: string;
  author: string;
  rating: number; // 1–5
  text: string;
  date: string; // ISO date string
  helpful: number;
};

type ReviewsStore = Record<string, Review[]>;

const REVIEWS_FILE = resolve(process.cwd(), "data/reviews.json");

async function readStore(): Promise<ReviewsStore> {
  try {
    const raw = await readFile(REVIEWS_FILE, "utf8");
    return JSON.parse(raw) as ReviewsStore;
  } catch {
    return {};
  }
}

async function writeStore(store: ReviewsStore): Promise<void> {
  await writeFile(REVIEWS_FILE, JSON.stringify(store, null, 2) + "\n", "utf8");
}

export async function getReviews(slug: string): Promise<Review[]> {
  const store = await readStore();
  return store[slug] ?? [];
}

export async function addReview(
  slug: string,
  author: string,
  rating: number,
  text: string,
): Promise<Review> {
  const store = await readStore();
  if (!store[slug]) {
    store[slug] = [];
  }
  const review: Review = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    author: author.trim().slice(0, 60) || "Anónimo",
    rating: Math.max(1, Math.min(5, Math.round(rating))),
    text: text.trim().slice(0, 1000),
    date: new Date().toISOString(),
    helpful: 0,
  };
  store[slug].unshift(review);
  // Keep only latest 200 reviews per game
  store[slug] = store[slug].slice(0, 200);
  await writeStore(store);
  return review;
}

export async function markHelpful(slug: string, reviewId: string): Promise<boolean> {
  const store = await readStore();
  const list = store[slug] ?? [];
  const review = list.find((r) => r.id === reviewId);
  if (!review) return false;
  review.helpful += 1;
  await writeStore(store);
  return true;
}
