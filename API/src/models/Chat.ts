import { Schema, model, Types } from "mongoose";

const identitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    publicKeyJwk: { type: Schema.Types.Mixed, required: true },
    privateKeyJwk: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

const wrappedKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ephemeralPublicJwk: { type: Schema.Types.Mixed, required: true },
    iv: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false },
);

const roomSchema = new Schema(
  {
    type: { type: String, enum: ["dm", "group"], required: true },
    title: { type: String, default: "" },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    dmKey: { type: String, default: "", index: true },
    wrappedKeys: [wrappedKeySchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

roomSchema.index({ memberIds: 1 });

const messageSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Texto legible con la sesión (cualquier dispositivo autenticado) */
    text: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    ciphertext: { type: String, default: "" },
    iv: { type: String, default: "" },
    at: { type: Number, required: true, index: true },
    editedAt: { type: Number, default: 0 },
  },
  { timestamps: false },
);

messageSchema.index({ roomId: 1, at: 1 });

export type WrappedKeyDoc = {
  userId: Types.ObjectId;
  ephemeralPublicJwk: JsonWebKey;
  iv: string;
  ciphertext: string;
};

export const ChatIdentity = model("ChatIdentity", identitySchema, "chat_identities");
export const ChatRoom = model("ChatRoom", roomSchema, "chat_rooms");
export const ChatMessage = model("ChatMessage", messageSchema, "chat_messages");
