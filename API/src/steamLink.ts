import crypto from "node:crypto";
import { Request, Response } from "express";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { verifyJwt } from "./auth.js";
import { User } from "./models/User.js";
import { loadSteamAccount } from "./steamSync.js";

const nonces = new Map<string, number>();

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function signState(payload: { sub: string; exp: number; nonce: string; origin: string }) {
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", config.jwtSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readState(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", config.jwtSecret).update(body).digest("base64url");
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      sub: string;
      exp: number;
      nonce: string;
      origin: string;
    };
    if (!payload.sub || !payload.nonce || payload.exp < Date.now()) return null;
    if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(payload.origin)) return null;
    return payload;
  } catch {
    return null;
  }
}

function rememberNonce(nonce: string, exp: number) {
  const now = Date.now();
  for (const [key, until] of nonces) {
    if (until < now) nonces.delete(key);
  }
  nonces.set(nonce, exp);
}

function takeNonce(nonce: string) {
  const exp = nonces.get(nonce);
  nonces.delete(nonce);
  return Boolean(exp && exp >= Date.now());
}

function browserOrigin(req: Request) {
  const forwarded = req.get("x-forwarded-host") || "";
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(forwarded)) {
    return `http://${forwarded}`;
  }
  try {
    return new URL(config.wwwOrigin).origin;
  } catch {
    return "http://127.0.0.1:5173";
  }
}

function userIdFromRequest(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return verifyJwt(header.slice(7).trim())?.sub || null;
}

function redirectProfile(origin: string, query: string, res: Response) {
  res.redirect(`${origin}/profile?${query}`);
}

async function saveSteamLink(userId: string, steamId: string) {
  const hasDb = await connectDb();
  if (!hasDb) {
    throw new Error("db");
  }
  const taken = await User.exists({ steamId, _id: { $ne: userId } });
  if (taken) {
    return null;
  }
  const account = await loadSteamAccount(steamId);
  const previous = await User.findById(userId).select("steamGames hiddenLibraryKeys");
  const hidden = new Set((previous?.hiddenLibraryKeys ?? []).filter(Boolean));
  const kept = new Map(
    (previous?.steamGames ?? []).map((game) => [
      game.steamAppId || game.slug,
      {
        isInstalled: game.isInstalled,
        isFavorite: game.isFavorite,
        userRating: game.userRating,
        userNote: game.userNote,
        purchased: game.purchased,
        edition: game.edition,
        paidPrice: game.paidPrice,
        saleStatus: game.saleStatus,
        salePayout: game.salePayout,
        desktopShortcut: game.desktopShortcut,
        taskbarPin: game.taskbarPin,
        beta: game.beta,
      },
    ]),
  );
  account.steamGames = account.steamGames
    .filter((game) => !hidden.has(game.slug) && !hidden.has(game.steamAppId || ""))
    .map((game) => {
      const saved = kept.get(game.steamAppId) || kept.get(game.slug);
      if (!saved) return game;
      return {
        ...game,
        isInstalled: Boolean(saved.isInstalled),
        isFavorite: Boolean(saved.isFavorite),
        ...(saved.userRating ? { userRating: saved.userRating } : {}),
        ...(saved.userNote ? { userNote: saved.userNote } : {}),
        ...(saved.purchased ? { purchased: true } : {}),
        ...(saved.edition ? { edition: saved.edition } : {}),
        ...(typeof saved.paidPrice === "number" && saved.paidPrice > 0 ? { paidPrice: saved.paidPrice } : {}),
        ...(saved.saleStatus === "pending" ? { saleStatus: "pending" as const, salePayout: saved.salePayout } : {}),
        ...(saved.desktopShortcut ? { desktopShortcut: true } : {}),
        ...(saved.taskbarPin ? { taskbarPin: true } : {}),
        ...(saved.beta ? { beta: saved.beta } : {}),
      };
    });
  const present = new Set(account.steamGames.flatMap((game) => [game.slug, game.steamAppId || ""]));
  const bought = (previous?.steamGames ?? []).filter(
    (game) =>
      game.purchased &&
      !present.has(game.slug) &&
      !hidden.has(game.slug) &&
      !hidden.has(game.steamAppId || ""),
  );
  account.steamGames = [...bought, ...account.steamGames];
  account.steamGameCount = account.steamGames.length;
  return User.findByIdAndUpdate(userId, { $set: account }, { new: true });
}

export async function steamStart(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Inicia sesión en GameNow antes de vincular Steam." });
    return;
  }

  const origin = browserOrigin(req);
  const nonce = crypto.randomBytes(16).toString("hex");
  const exp = Date.now() + 10 * 60 * 1000;
  rememberNonce(nonce, exp);
  const state = signState({ sub: userId, exp, nonce, origin });
  const returnTo = `${origin}/api/auth/steam/callback?state=${encodeURIComponent(state)}`;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  res.json({ url: `https://steamcommunity.com/openid/login?${params.toString()}` });
}

export async function steamCallback(req: Request, res: Response) {
  const stateToken = typeof req.query.state === "string" ? req.query.state : "";
  const state = readState(stateToken);
  const origin = state?.origin || browserOrigin(req);
  if (!state || !takeNonce(state.nonce)) {
    redirectProfile(origin, "steam=error&reason=invalid", res);
    return;
  }

  const mode = typeof req.query["openid.mode"] === "string" ? req.query["openid.mode"] : "";
  if (mode === "cancel") {
    redirectProfile(origin, "steam=error&reason=cancel", res);
    return;
  }

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (!key.startsWith("openid.") || typeof value !== "string") continue;
    body.set(key, key === "openid.mode" ? "check_authentication" : value);
  }

  try {
    const check = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const text = await check.text();
    if (!check.ok || !text.includes("is_valid:true")) {
      redirectProfile(origin, "steam=error&reason=invalid", res);
      return;
    }

    const claimed = typeof req.query["openid.claimed_id"] === "string" ? req.query["openid.claimed_id"] : "";
    const steamId = claimed.match(/\/id\/(\d{17})$/)?.[1];
    if (!steamId) {
      redirectProfile(origin, "steam=error&reason=invalid", res);
      return;
    }

    const user = await saveSteamLink(state.sub, steamId);
    if (!user) {
      redirectProfile(origin, "steam=error&reason=taken", res);
      return;
    }
    redirectProfile(origin, "steam=linked", res);
  } catch (error) {
    console.error("Steam callback:", error instanceof Error ? error.message : error);
    redirectProfile(origin, "steam=error&reason=steam", res);
  }
}

export async function steamRefresh(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  try {
    const hasDb = await connectDb();
    if (!hasDb) {
      res.status(503).json({ error: "La base de datos no está disponible." });
      return;
    }
    const current = await User.findById(userId).select("steamId");
    if (!current?.steamId) {
      res.status(404).json({ error: "No hay una cuenta de Steam vinculada." });
      return;
    }
    const user = await saveSteamLink(userId, current.steamId);
    if (!user) {
      res.status(409).json({ error: "Esa cuenta de Steam ya está vinculada a otro usuario." });
      return;
    }
    res.json({ user: user.toJSON() });
  } catch (error) {
    console.error("Steam refresh:", error instanceof Error ? error.message : error);
    res.status(502).json({ error: "No se pudo leer tu perfil público de Steam." });
  }
}

export async function steamUnlink(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  const hasDb = await connectDb();
  if (!hasDb) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return;
  }
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        steamId: 1,
        steamName: 1,
        steamAvatarUrl: 1,
        steamFrameUrl: 1,
        steamBackgroundUrl: 1,
        steamBackgroundVideo: 1,
        steamGameCount: 1,
      },
      $set: { steamGames: [] },
    },
    { new: true },
  );
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  res.json({ user: user.toJSON() });
}
