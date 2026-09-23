import mongoose from "mongoose";
import { connectDb } from "./db.js";
import { signJwt } from "./auth.js";
import { User } from "./models/User.js";

await connectDb();
const user = await User.findOne({ steamId: { $exists: true } });
if (!user) throw new Error("no linked user");
const token = signJwt(user);
await mongoose.disconnect();

const base = "http://localhost:5173";
const auth = { Authorization: `Bearer ${token}` };
for (const [method, path] of [
  ["GET", "/api/auth/me"],
  ["GET", "/api/auth/steam/start"],
  ["GET", "/api/steam/friends"],
  ["GET", `/api/steam/profile/${user.steamId}`],
] as const) {
  const response = await fetch(base + path, { method, headers: auth });
  const text = await response.text();
  console.log(method, path, response.status, text.slice(0, 220).replace(/\s+/g, " "));
}
