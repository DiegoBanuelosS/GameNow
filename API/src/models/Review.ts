import { Schema, model } from "mongoose";

const reviewSchema = new Schema(
  {
    slug: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    author: { type: String, required: true, maxlength: 60 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, maxlength: 1000 },
    helpful: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

reviewSchema.index({ slug: 1, userId: 1 }, { unique: true });

export const ReviewModel = model("Review", reviewSchema, "reviews");
