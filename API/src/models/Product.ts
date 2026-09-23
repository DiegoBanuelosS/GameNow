import { Schema, model } from "mongoose";

const assetSchema = new Schema(
  {
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video"], required: true },
    local: String,
    hosted: { type: Boolean, default: false },
  },
  { _id: false },
);

const requirementSchema = new Schema(
  {
    label: { type: String, required: true },
    min: { type: String, default: "" },
    max: { type: String, default: "" },
  },
  { _id: false },
);

const detailsSchema = new Schema(
  {
    release: String,
    platforms: String,
    description: String,
    requirementsNote: String,
    requirements: { type: [requirementSchema], default: undefined },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    studio: { type: String, default: "" },
    alt: { type: String, required: true },
    price: { type: Number, required: true },
    compareAtPrice: { type: Number },
    currency: { type: String, default: "MXN" },
    sections: {
      ad: { type: Number, default: null },
      event: { type: Number, default: null },
      offer: { type: Number, default: null },
    },
    cover: { type: assetSchema, required: true },
    studioLogo: { type: assetSchema },
    trailer: { type: assetSchema },
    screenshots: { type: [String], default: undefined },
    youtubeTrailers: { type: [String], default: undefined },
    metacritic: Number,
    steamRating: String,
    details: { type: detailsSchema },
  },
  { timestamps: true },
);

export const Product = model("Product", productSchema, "products");
