import { Schema, model, Document } from "mongoose";
import type { SteamLibraryGame } from "../steamSync.js";

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  avatarUrl: string;
  steamId?: string;
  steamName?: string;
  steamAvatarUrl?: string;
  steamFrameUrl?: string;
  steamBackgroundUrl?: string;
  steamBackgroundVideo?: string;
  steamGameCount?: number;
  balance: number;
  cardLast4: string;
  steamGames: SteamLibraryGame[];
  /** Slugs / steamAppIds ocultos en GameNow (no vuelven al sincronizar Steam) */
  hiddenLibraryKeys: string[];
  friendPrefs: {
    steamId: string;
    favorite?: boolean;
    hidden?: boolean;
    added?: boolean;
    /** Solicitud enviada, pendiente de aceptación */
    outgoing?: boolean;
    name?: string;
    avatarUrl?: string;
    username?: string;
    inviteGame?: string;
    messages?: { text?: string; at?: number }[];
  }[];
  incomingFriendRequests: {
    fromUserId: string;
    steamId: string;
    name: string;
    avatarUrl: string;
    username: string;
    at: number;
  }[];
  failedLoginAttempts: number;
  lockUntil: Date | null;
  lastLogin: Date | null;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "El nombre de usuario es obligatorio"],
      unique: true,
      trim: true,
      minlength: [3, "El nombre de usuario debe tener al menos 3 caracteres"],
      maxlength: [25, "El nombre de usuario no puede exceder 25 caracteres"],
      match: [/^[a-zA-Z0-9_.-]+$/, "El nombre de usuario solo puede contener letras, números, guiones y puntos"],
      index: true,
    },
    email: {
      type: String,
      required: [true, "El correo electrónico es obligatorio"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "El formato del correo electrónico no es válido",
      ],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    steamId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    steamName: String,
    steamAvatarUrl: String,
    steamFrameUrl: String,
    steamBackgroundUrl: String,
    steamBackgroundVideo: String,
    steamGameCount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    cardLast4: { type: String, default: "" },
    steamGames: {
      type: [
        new Schema(
          {
            slug: String,
            steamAppId: String,
            name: String,
            cover: String,
            coverSrcSet: String,
            coverFallback: String,
            banner: String,
            miniIcon: String,
            genre: String,
            lastPlayed: String,
            lastPlayedTimestamp: Number,
            playTimeHours: Number,
            isInstalled: Boolean,
            isFavorite: Boolean,
            userRating: Number,
            userNote: String,
            purchased: Boolean,
            edition: String,
            paidPrice: Number,
            saleStatus: String,
            salePayout: Number,
            desktopShortcut: Boolean,
            taskbarPin: Boolean,
            beta: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    hiddenLibraryKeys: {
      type: [String],
      default: [],
    },
    friendPrefs: {
      type: [
        new Schema(
          {
            steamId: String,
            favorite: Boolean,
            hidden: Boolean,
            added: Boolean,
            outgoing: Boolean,
            name: String,
            avatarUrl: String,
            username: String,
            inviteGame: String,
            messages: {
              type: [{ text: String, at: Number }],
              default: [],
            },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    incomingFriendRequests: {
      type: [
        new Schema(
          {
            fromUserId: String,
            steamId: String,
            name: String,
            avatarUrl: String,
            username: String,
            at: Number,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).passwordHash;
        delete (ret as Record<string, unknown>).failedLoginAttempts;
        delete (ret as Record<string, unknown>).lockUntil;
        delete (ret as Record<string, unknown>).hiddenLibraryKeys;
        delete (ret as Record<string, unknown>).tokenVersion;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

export const User = model<IUser>("User", userSchema, "users");
