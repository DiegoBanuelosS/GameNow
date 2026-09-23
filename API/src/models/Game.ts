import { Schema, model } from "mongoose";

const gameSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    steamAppId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    alt: { type: String, required: true },
    price: { type: Number, required: true },
    compareAtPrice: Number,
    metacritic: { type: Number, default: 0 },
    steamRating: { type: String, default: "" },
    source: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Game = model("Game", gameSchema, "games");
