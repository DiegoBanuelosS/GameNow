import { Request, Response, Router } from "express";
import { v2 as cloudinary } from "cloudinary";
import { Types } from "mongoose";
import { verifyJwt } from "./auth.js";
import { requireCloudinary } from "./config.js";
import { connectDb } from "./db.js";
import { ChatIdentity, ChatMessage, ChatRoom } from "./models/Chat.js";
import { User } from "./models/User.js";
import { resolveSteamBackground } from "./steamSync.js";

function userIdFromRequest(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return verifyJwt(header.slice(7).trim())?.sub || null;
}

async function requireUser(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return null;
  }
  if (!(await connectDb())) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return null;
  }
  return userId;
}

function dmKeyFor(a: string, b: string) {
  return [a, b].sort().join(":");
}

function isObjectId(value: string) {
  return Types.ObjectId.isValid(value) && String(new Types.ObjectId(value)) === value;
}

async function resolveMemberId(raw: string): Promise<string | null> {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (value.startsWith("user:")) {
    const id = value.slice(5);
    return isObjectId(id) ? id : null;
  }
  if (isObjectId(value)) return value;
  if (/^\d{17}$/.test(value)) {
    const user = await User.findOne({ steamId: value }).select("_id").lean();
    return user?._id ? String(user._id) : null;
  }
  return null;
}

function publicRoom(room: {
  _id: Types.ObjectId;
  type: string;
  title?: string;
  memberIds: Types.ObjectId[];
  wrappedKeys: { userId: Types.ObjectId; ephemeralPublicJwk: unknown; iv: string; ciphertext: string }[];
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(room._id),
    type: room.type,
    title: room.title || "",
    memberIds: room.memberIds.map(String),
    wrappedKeys: room.wrappedKeys.map((item) => ({
      userId: String(item.userId),
      ephemeralPublicJwk: item.ephemeralPublicJwk,
      iv: item.iv,
      ciphertext: item.ciphertext,
    })),
    createdBy: String(room.createdBy),
    createdAt: room.createdAt?.toISOString?.() || "",
    updatedAt: room.updatedAt?.toISOString?.() || "",
  };
}

async function roomWithMembers(room: Parameters<typeof publicRoom>[0]) {
  const users = await User.find({ _id: { $in: room.memberIds } })
    .select("username steamId steamName steamAvatarUrl avatarUrl steamBackgroundUrl steamBackgroundVideo")
    .lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  const last = await ChatMessage.findOne({ roomId: room._id }).sort({ at: -1 }).lean();
  const members = await Promise.all(
    room.memberIds.map(async (id) => {
      const user = byId.get(String(id));
      let backgroundUrl = user?.steamBackgroundUrl || "";
      let backgroundVideo = user?.steamBackgroundVideo || "";
      if (!backgroundUrl && !backgroundVideo && user?.steamId) {
        const background = await resolveSteamBackground(user.steamId);
        backgroundUrl = background.image;
        backgroundVideo = background.video;
        if (backgroundUrl || backgroundVideo) {
          void User.updateOne(
            { _id: id },
            { $set: { steamBackgroundUrl: backgroundUrl, steamBackgroundVideo: backgroundVideo } },
          );
        }
      }
      return {
        id: String(id),
        steamId: user?.steamId || "",
        name: user?.steamName || user?.username || "Jugador",
        avatarUrl: user?.steamAvatarUrl || user?.avatarUrl || "",
        backgroundUrl,
        backgroundVideo,
      };
    }),
  );
  return {
    ...publicRoom(room),
    members,
    lastMessage: last
      ? {
          senderId: String(last.senderId),
          ciphertext: last.ciphertext || "",
          iv: last.iv || "",
          text: typeof last.text === "string" ? last.text : "",
          imageUrl: typeof last.imageUrl === "string" ? last.imageUrl : "",
          at: last.at,
        }
      : null,
  };
}

export const chatRouter = Router();

chatRouter.post("/upload", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const image = typeof req.body?.image === "string" ? req.body.image : "";
  if (!image.startsWith("data:image/")) {
    res.status(400).json({ error: "Imagen inválida." });
    return;
  }
  if (image.length > 3_500_000) {
    res.status(400).json({ error: "La imagen es demasiado grande (máx. ~2.5 MB)." });
    return;
  }
  try {
    const creds = requireCloudinary();
    cloudinary.config({
      cloud_name: creds.cloudName,
      api_key: creds.apiKey,
      api_secret: creds.apiSecret,
    });
    const result = await cloudinary.uploader.upload(image, {
      folder: "gamenow/chat",
      resource_type: "image",
      transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto:good" }],
    });
    res.json({ url: result.secure_url });
  } catch (error) {
    console.error("Chat upload:", error instanceof Error ? error.message : error);
    res.status(502).json({ error: "No se pudo subir la imagen." });
  }
});

chatRouter.put("/keys", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const publicKeyJwk = req.body?.publicKeyJwk;
  const privateKeyJwk = req.body?.privateKeyJwk;
  if (!publicKeyJwk || typeof publicKeyJwk !== "object") {
    res.status(400).json({ error: "Falta la clave pública." });
    return;
  }
  if (!privateKeyJwk || typeof privateKeyJwk !== "object") {
    res.status(400).json({ error: "Falta la clave privada." });
    return;
  }
  await ChatIdentity.findOneAndUpdate(
    { userId },
    { userId, publicKeyJwk, privateKeyJwk },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.json({ ok: true });
});

chatRouter.get("/keys/me", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const identity = await ChatIdentity.findOne({ userId }).lean();
  if (!identity?.publicKeyJwk || !identity?.privateKeyJwk) {
    res.status(404).json({ error: "Sin claves guardadas." });
    return;
  }
  res.json({
    userId,
    publicKeyJwk: identity.publicKeyJwk,
    privateKeyJwk: identity.privateKeyJwk,
  });
});

chatRouter.get("/keys/:userId", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const target = String(req.params.userId || "");
  if (target === "me") {
    res.status(404).json({ error: "Usa /keys/me." });
    return;
  }
  if (!isObjectId(target)) {
    res.status(400).json({ error: "Usuario inválido." });
    return;
  }
  const identity = await ChatIdentity.findOne({ userId: target }).lean();
  if (!identity) {
    res.status(404).json({ error: "Esa cuenta todavía no abrió el chat." });
    return;
  }
  res.json({ userId: target, publicKeyJwk: identity.publicKeyJwk });
});

chatRouter.get("/lookup/:ref", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const id = await resolveMemberId(decodeURIComponent(String(req.params.ref || "")));
  if (!id) {
    res.status(404).json({ error: "Esa persona no tiene cuenta GameNow." });
    return;
  }
  const person = await User.findById(id).select("username steamName steamAvatarUrl avatarUrl").lean();
  res.json({
    id,
    name: person?.steamName || person?.username || "Jugador",
    avatarUrl: person?.steamAvatarUrl || person?.avatarUrl || "",
  });
});

chatRouter.get("/rooms", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const rooms = await ChatRoom.find({ memberIds: userId }).sort({ updatedAt: -1 }).lean();
  res.json({
    rooms: await Promise.all(rooms.map((room) => roomWithMembers(room))),
  });
});

chatRouter.post("/rooms", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;

  const type = req.body?.type === "group" ? "group" : "dm";
  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 80) : "";
  const rawMembers: string[] = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : [];
  const wrappedKeys = Array.isArray(req.body?.wrappedKeys) ? req.body.wrappedKeys : [];

  const resolved = new Set<string>([userId]);
  for (const raw of rawMembers) {
    const id = await resolveMemberId(raw);
    if (id) resolved.add(id);
  }
  const memberIds = [...resolved];
  if (type === "dm" && memberIds.length !== 2) {
    res.status(400).json({ error: "Un chat directo necesita exactamente a otra persona con cuenta GameNow." });
    return;
  }
  if (type === "group" && memberIds.length < 2) {
    res.status(400).json({ error: "El grupo necesita al menos un amigo." });
    return;
  }
  if (type === "group" && !title) {
    res.status(400).json({ error: "Ponle nombre al grupo." });
    return;
  }

  for (const memberId of memberIds) {
    const wrap = wrappedKeys.find((item: { userId?: string }) => String(item?.userId) === memberId);
    if (!wrap?.ciphertext || !wrap?.iv || !wrap?.ephemeralPublicJwk) {
      res.status(400).json({ error: "Faltan claves cifradas para todos los miembros." });
      return;
    }
  }

  if (type === "dm") {
    const key = dmKeyFor(memberIds[0], memberIds[1]);
    const existing = await ChatRoom.findOne({ type: "dm", dmKey: key }).lean();
    if (existing) {
      res.json({ room: await roomWithMembers(existing), created: false });
      return;
    }
    const room = await ChatRoom.create({
      type: "dm",
      title: "",
      memberIds,
      dmKey: key,
      wrappedKeys: wrappedKeys.map((item: { userId: string; ephemeralPublicJwk: unknown; iv: string; ciphertext: string }) => ({
        userId: item.userId,
        ephemeralPublicJwk: item.ephemeralPublicJwk,
        iv: item.iv,
        ciphertext: item.ciphertext,
      })),
      createdBy: userId,
    });
    res.status(201).json({ room: await roomWithMembers(room.toObject()), created: true });
    return;
  }

  const room = await ChatRoom.create({
    type: "group",
    title,
    memberIds,
    dmKey: "",
    wrappedKeys: wrappedKeys.map((item: { userId: string; ephemeralPublicJwk: unknown; iv: string; ciphertext: string }) => ({
      userId: item.userId,
      ephemeralPublicJwk: item.ephemeralPublicJwk,
      iv: item.iv,
      ciphertext: item.ciphertext,
    })),
    createdBy: userId,
  });
  res.status(201).json({ room: await roomWithMembers(room.toObject()), created: true });
});

chatRouter.get("/rooms/:id/messages", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const roomId = String(req.params.id || "");
  if (!isObjectId(roomId)) {
    res.status(400).json({ error: "Sala inválida." });
    return;
  }
  const room = await ChatRoom.findById(roomId).lean();
  if (!room || !room.memberIds.some((id) => String(id) === userId)) {
    res.status(404).json({ error: "No está en esta conversación." });
    return;
  }
  const since = Number(req.query.since) || 0;
  const messages = await ChatMessage.find({
    roomId,
    ...(since > 0 ? { at: { $gt: since } } : {}),
  })
    .sort({ at: 1 })
    .limit(200)
    .lean();
  res.json({
    messages: messages.map((message) => ({
      id: String(message._id),
      roomId: String(message.roomId),
      senderId: String(message.senderId),
      text: typeof message.text === "string" ? message.text : "",
      imageUrl: typeof message.imageUrl === "string" ? message.imageUrl : "",
      ciphertext: message.ciphertext || "",
      iv: message.iv || "",
      at: message.at,
      editedAt: message.editedAt || 0,
    })),
  });
});

chatRouter.patch("/rooms/:id/messages/:messageId", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const roomId = String(req.params.id || "");
  const messageId = String(req.params.messageId || "");
  if (!isObjectId(roomId) || !isObjectId(messageId)) {
    res.status(400).json({ error: "Mensaje inválido." });
    return;
  }
  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 2000) : "";
  const ciphertext = typeof req.body?.ciphertext === "string" ? req.body.ciphertext : "";
  const iv = typeof req.body?.iv === "string" ? req.body.iv : "";
  if (!text) {
    res.status(400).json({ error: "Mensaje incompleto." });
    return;
  }
  const room = await ChatRoom.findById(roomId).lean();
  if (!room || !room.memberIds.some((id) => String(id) === userId)) {
    res.status(404).json({ error: "No está en esta conversación." });
    return;
  }
  const message = await ChatMessage.findOne({ _id: messageId, roomId });
  if (!message || String(message.senderId) !== userId) {
    res.status(404).json({ error: "No puedes editar este mensaje." });
    return;
  }
  message.text = text;
  if (ciphertext && iv) {
    message.ciphertext = ciphertext;
    message.iv = iv;
  }
  message.editedAt = Date.now();
  await message.save();
  res.json({
    message: {
      id: String(message._id),
      roomId,
      senderId: userId,
      text,
      ciphertext: message.ciphertext || "",
      iv: message.iv || "",
      at: message.at,
      editedAt: message.editedAt,
    },
  });
});

chatRouter.delete("/rooms/:id/messages/:messageId", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const roomId = String(req.params.id || "");
  const messageId = String(req.params.messageId || "");
  if (!isObjectId(roomId) || !isObjectId(messageId)) {
    res.status(400).json({ error: "Mensaje inválido." });
    return;
  }
  const room = await ChatRoom.findById(roomId).lean();
  if (!room || !room.memberIds.some((id) => String(id) === userId)) {
    res.status(404).json({ error: "No está en esta conversación." });
    return;
  }
  const message = await ChatMessage.findOne({ _id: messageId, roomId });
  if (!message || String(message.senderId) !== userId) {
    res.status(404).json({ error: "No puedes eliminar este mensaje." });
    return;
  }
  await message.deleteOne();
  res.json({ ok: true, id: messageId });
});

chatRouter.delete("/rooms/:id", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const roomId = String(req.params.id || "");
  if (!isObjectId(roomId)) {
    res.status(400).json({ error: "Sala inválida." });
    return;
  }
  const room = await ChatRoom.findById(roomId);
  if (!room || !room.memberIds.some((id) => String(id) === userId)) {
    res.status(404).json({ error: "No está en esta conversación." });
    return;
  }
  if (room.type === "dm") {
    await ChatMessage.deleteMany({ roomId: room._id });
    await room.deleteOne();
    res.json({ ok: true, deleted: true });
    return;
  }
  room.memberIds = room.memberIds.filter((id) => String(id) !== userId) as typeof room.memberIds;
  const remainingKeys = room.wrappedKeys.filter((item) => String(item.userId) !== userId);
  room.wrappedKeys.splice(0, room.wrappedKeys.length, ...remainingKeys);
  if (room.memberIds.length < 2) {
    await ChatMessage.deleteMany({ roomId: room._id });
    await room.deleteOne();
    res.json({ ok: true, deleted: true });
    return;
  }
  await room.save();
  res.json({ ok: true, left: true });
});

chatRouter.post("/rooms/:id/messages", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const roomId = String(req.params.id || "");
  if (!isObjectId(roomId)) {
    res.status(400).json({ error: "Sala inválida." });
    return;
  }
  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 2000) : "";
  const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim().slice(0, 500) : "";
  const ciphertext = typeof req.body?.ciphertext === "string" ? req.body.ciphertext : "";
  const iv = typeof req.body?.iv === "string" ? req.body.iv : "";
  if (!text && !imageUrl) {
    res.status(400).json({ error: "Mensaje incompleto." });
    return;
  }
  if (imageUrl && !/^https:\/\/res\.cloudinary\.com\//.test(imageUrl)) {
    res.status(400).json({ error: "URL de imagen no permitida." });
    return;
  }
  const room = await ChatRoom.findById(roomId);
  if (!room || !room.memberIds.some((id) => String(id) === userId)) {
    res.status(404).json({ error: "No está en esta conversación." });
    return;
  }
  const at = Date.now();
  const message = await ChatMessage.create({
    roomId,
    senderId: userId,
    text,
    imageUrl,
    ciphertext: ciphertext || "",
    iv: iv || "",
    at,
  });
  room.updatedAt = new Date();
  await room.save();
  res.status(201).json({
    message: {
      id: String(message._id),
      roomId,
      senderId: userId,
      text,
      imageUrl,
      ciphertext: message.ciphertext || "",
      iv: message.iv || "",
      at,
      editedAt: 0,
    },
  });
});

chatRouter.post("/rooms/:id/members", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const roomId = String(req.params.id || "");
  if (!isObjectId(roomId)) {
    res.status(400).json({ error: "Sala inválida." });
    return;
  }
  const room = await ChatRoom.findById(roomId);
  if (!room || room.type !== "group" || !room.memberIds.some((id) => String(id) === userId)) {
    res.status(404).json({ error: "Grupo no encontrado." });
    return;
  }
  const rawMembers: string[] = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : [];
  const wrappedKeys = Array.isArray(req.body?.wrappedKeys) ? req.body.wrappedKeys : [];
  for (const raw of rawMembers) {
    const id = await resolveMemberId(raw);
    if (!id || room.memberIds.some((member) => String(member) === id)) continue;
    const wrap = wrappedKeys.find((item: { userId?: string }) => String(item?.userId) === id);
    if (!wrap?.ciphertext || !wrap?.iv || !wrap?.ephemeralPublicJwk) {
      res.status(400).json({ error: "Falta la clave cifrada del nuevo miembro." });
      return;
    }
    room.memberIds.push(new Types.ObjectId(id));
    room.wrappedKeys.push({
      userId: new Types.ObjectId(id),
      ephemeralPublicJwk: wrap.ephemeralPublicJwk,
      iv: wrap.iv,
      ciphertext: wrap.ciphertext,
    });
  }
  await room.save();
  res.json({ room: publicRoom(room.toObject()) });
});
