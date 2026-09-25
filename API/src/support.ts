import type { Request, Response } from "express";
import { verifyJwt } from "./auth.js";
import { connectDb } from "./db.js";
import { User } from "./models/User.js";

function userIdFromRequest(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return verifyJwt(header.slice(7).trim())?.sub || null;
}

/** Guarda un mensaje de soporte del usuario autenticado. */
export async function submitSupport(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim().slice(0, 160) : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 4000) : "";
  const gameSlug = typeof req.body?.gameSlug === "string" ? req.body.gameSlug.trim().slice(0, 80) : "";

  if (!subject || !message) {
    res.status(400).json({ error: "Escribe un asunto y un mensaje." });
    return;
  }

  const hasDb = await connectDb();
  if (!hasDb) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return;
  }

  const user = await User.findById(userId).select("username email");
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  console.info("[support]", {
    userId,
    username: user.username,
    email: user.email,
    subject,
    gameSlug: gameSlug || undefined,
    message,
    at: new Date().toISOString(),
  });

  res.json({ ok: true });
}
