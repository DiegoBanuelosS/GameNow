import { Schema, model } from "mongoose";

const tradeSchema = new Schema(
  {
    slug: { type: String, required: true, index: true },
    kind: { type: String, enum: ["buy", "sell"], required: true },
    userId: { type: String, required: true },
    amount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Trade = model("Trade", tradeSchema, "trades");
