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

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    authPanel: { type: assetSchema },
  },
  { timestamps: true },
);

export const Setting = model("Setting", settingSchema, "settings");
