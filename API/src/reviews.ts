import { connectDb } from "./db.js";
import { ReviewModel } from "./models/Review.js";
import { User } from "./models/User.js";

export type Review = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  helpful: number;
};

function toReview(row: {
  _id: { toString(): string };
  author: string;
  rating: number;
  text: string;
  createdAt?: Date;
  helpful?: number;
}): Review {
  return {
    id: String(row._id),
    author: row.author,
    rating: row.rating,
    text: row.text,
    date: (row.createdAt ?? new Date()).toISOString(),
    helpful: row.helpful ?? 0,
  };
}

export async function getReviews(slug: string): Promise<Review[]> {
  if (!(await connectDb())) {
    return [];
  }
  const rows = await ReviewModel.find({ slug }).sort({ createdAt: -1 }).limit(200).lean();
  return rows.map((row) => toReview(row));
}

export async function userOwnsGame(userId: string, slug: string): Promise<boolean> {
  if (!(await connectDb())) {
    return false;
  }
  const user = await User.findById(userId).select("steamGames.slug").lean();
  return Boolean(user?.steamGames?.some((game) => game.slug === slug));
}

export async function addReview(
  slug: string,
  userId: string,
  author: string,
  rating: number,
  text: string,
): Promise<{ review?: Review; error?: "duplicate" | "db" }> {
  if (!(await connectDb())) {
    return { error: "db" };
  }
  const existing = await ReviewModel.findOne({ slug, userId }).lean();
  if (existing) {
    return { error: "duplicate" };
  }
  try {
    const created = await ReviewModel.create({
      slug,
      userId,
      author: author.trim().slice(0, 60) || "Anónimo",
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      text: text.trim().slice(0, 1000),
      helpful: 0,
    });
    return { review: toReview(created) };
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 11000) {
      return { error: "duplicate" };
    }
    throw error;
  }
}

export async function markHelpful(slug: string, reviewId: string): Promise<boolean> {
  if (!(await connectDb())) {
    return false;
  }
  const updated = await ReviewModel.findOneAndUpdate(
    { _id: reviewId, slug },
    { $inc: { helpful: 1 } },
    { new: true },
  );
  return Boolean(updated);
}
