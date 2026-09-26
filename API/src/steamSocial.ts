import { Request, Response } from "express";
import { Types } from "mongoose";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { verifyJwt } from "./auth.js";
import { User } from "./models/User.js";
import { loadProducts } from "./catalog.js";
import { loadGames } from "./games.js";
import { formatMxn, toMxn } from "./money.js";
import { purchasePrice, quoteResale, recordTrade } from "./resale.js";
import { loadSteamVisit, resolveSteamBackground, resolveSteamMiniBackground, type SteamLibraryGame } from "./steamSync.js";

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: number;
};

type Friend = {
  steamId: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
  status: string;
  playingGame: string;
  playingAppId: string;
  playingMinutes: number;
  playingSpan: "" | "week" | "total";
  favorite: boolean;
  inviteGame: string;
  messages: { text: string; at: number }[];
  backgroundUrl?: string;
  backgroundVideo?: string;
};

const achievementCache = new Map<string, { at: number; achievements: Achievement[] }>();
const friendIdCache = new Map<string, { at: number; ids: Set<string> }>();
const visitCache = new Map<string, { at: number; profile: Awaited<ReturnType<typeof loadSteamVisit>> }>();

function userIdFromRequest(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return verifyJwt(header.slice(7).trim())?.sub || null;
}

async function steamJson<T>(url: string): Promise<T | null> {
  if (!config.steamApiKey) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export async function steamAchievements(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  const appId = String(req.params.appId || "").replace(/\D/g, "");
  if (!appId) {
    res.status(400).json({ error: "Falta el juego." });
    return;
  }

  const hasDb = await connectDb();
  if (!hasDb) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return;
  }
  const user = await User.findById(userId).select("steamId");
  if (!user?.steamId) {
    res.status(404).json({ error: "No hay una cuenta de Steam vinculada." });
    return;
  }

  const cacheKey = `${user.steamId}:${appId}`;
  const cached = achievementCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
    res.json({ achievements: cached.achievements });
    return;
  }

  try {
    const key = encodeURIComponent(config.steamApiKey);
    const [player, schema, global] = await Promise.all([
      steamJson<{
        playerstats?: { achievements?: { apiname: string; achieved: number; unlocktime?: number }[] };
      }>(
        `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appId}&key=${key}&steamid=${user.steamId}&l=spanish`,
      ),
      steamJson<{
        game?: {
          availableGameStats?: {
            achievements?: { name: string; displayName?: string; description?: string; icon?: string; icongray?: string }[];
          };
        };
      }>(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0002/?key=${key}&appid=${appId}&l=spanish`),
      steamJson<{ achievementpercentages?: { achievements?: { name: string }[] } }>(
        `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appId}`,
      ),
    ]);

    const schemaItems = schema?.game?.availableGameStats?.achievements ?? [];
    const globalItems = global?.achievementpercentages?.achievements ?? [];
    if (!player && !schema && globalItems.length === 0) {
      res.status(502).json({ error: "No se pudieron leer los logros." });
      return;
    }

    const unlocked = new Map((player?.playerstats?.achievements ?? []).map((item) => [item.apiname, item]));
    const source = schemaItems.length
      ? schemaItems
      : globalItems.map((item) => ({
          name: item.name,
          displayName: item.name
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (letter) => letter.toUpperCase()),
          description: "",
          icon: "",
          icongray: "",
        }));
    const achievements: Achievement[] = source.map((item) => {
        const progress = unlocked.get(item.name);
        return {
          id: item.name,
          name: item.displayName || item.name,
          description: item.description || "",
          icon: (progress?.achieved ? item.icon : item.icongray) || item.icon || "",
          unlocked: progress?.achieved === 1,
          unlockedAt: (progress?.unlocktime || 0) * 1000,
        };
    });
    achievements.sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || a.name.localeCompare(b.name));
    achievementCache.set(cacheKey, { at: Date.now(), achievements });
    res.json({ achievements });
  } catch (error) {
    console.error("Steam achievements:", error instanceof Error ? error.message : error);
    res.status(502).json({ error: "No se pudieron leer los logros." });
  }
}

export async function steamFriends(req: Request, res: Response) {
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
  const user = await User.findById(userId).select("steamId friendPrefs incomingFriendRequests");
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  const requests = (user.incomingFriendRequests ?? []).map((item) => ({
    fromUserId: item.fromUserId || "",
    steamId: item.steamId || "",
    name: item.name || item.username || "Jugador",
    avatarUrl: item.avatarUrl || "",
    username: item.username || "",
    at: item.at || 0,
  }));

  const friends: Friend[] = [];
  let hidden = false;
  let linked = Boolean(user.steamId);

  try {
    if (user.steamId) {
      const key = encodeURIComponent(config.steamApiKey);
      const list = await steamJson<{ friendslist?: { friends?: { steamid: string }[] } }>(
        `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${user.steamId}&relationship=friend`,
      );
      const ids = (list?.friendslist?.friends ?? []).map((friend) => friend.steamid).filter(Boolean);
      if (!list?.friendslist) {
        hidden = true;
      } else {
        const prefs = new Map((user.friendPrefs ?? []).map((item) => [item.steamId, item]));
        for (let index = 0; index < ids.length; index += 100) {
          const chunk = ids.slice(index, index + 100).join(",");
          const summaries = await steamJson<{
            response?: {
              players?: {
                steamid: string;
                personaname?: string;
                avatarfull?: string;
                profileurl?: string;
                personastate?: number;
                gameid?: string;
                gameextrainfo?: string;
              }[];
            };
          }>(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${chunk}`);
          for (const player of summaries?.response?.players ?? []) {
            const pref = prefs.get(player.steamid);
            if (pref?.hidden) continue;
            let playingMinutes = 0;
            let playingSpan: Friend["playingSpan"] = "";
            if (player.gameid) {
              const recent = await steamJson<{
                response?: { games?: { appid: number; playtime_2weeks?: number; playtime_forever?: number }[] };
              }>(
                `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${key}&steamid=${player.steamid}&count=8`,
              );
              const current = recent?.response?.games?.find((item) => String(item.appid) === String(player.gameid));
              if (current?.playtime_2weeks) {
                playingMinutes = current.playtime_2weeks;
                playingSpan = "week";
              } else if (current?.playtime_forever) {
                playingMinutes = current.playtime_forever;
                playingSpan = "total";
              }
            }
            friends.push({
              steamId: player.steamid,
              name: player.personaname || "Amigo",
              avatarUrl: player.avatarfull || "",
              profileUrl: player.profileurl || `https://steamcommunity.com/profiles/${player.steamid}`,
              status: player.personastate ? "En línea" : "Desconectado",
              playingGame: player.gameextrainfo || "",
              playingAppId: player.gameid || "",
              playingMinutes,
              playingSpan,
              favorite: Boolean(pref?.favorite),
              inviteGame: pref?.inviteGame || "",
              messages: (pref?.messages ?? []).slice(-20).map((message) => ({
                text: message.text || "",
                at: message.at || 0,
              })),
            });
          }
        }
      }
    }

    const listed = new Set(friends.map((friend) => friend.steamId));
    const extras = (user.friendPrefs ?? []).filter(
      (pref) => pref.added && !pref.hidden && !pref.outgoing && pref.steamId && !listed.has(pref.steamId),
    );
    const steamExtras = extras.filter((pref) => /^\d{17}$/.test(pref.steamId));
    if (steamExtras.length && user.steamId) {
      const key = encodeURIComponent(config.steamApiKey);
      const chunk = steamExtras.map((pref) => pref.steamId).join(",");
      const summaries = await steamJson<{
        response?: { players?: { steamid: string; personaname?: string; avatarfull?: string; profileurl?: string; personastate?: number }[] };
      }>(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${chunk}`);
      const byId = new Map((summaries?.response?.players ?? []).map((player) => [player.steamid, player]));
      for (const pref of steamExtras) {
        const player = byId.get(pref.steamId);
        friends.push({
          steamId: pref.steamId,
          name: player?.personaname || pref.name || "Amigo",
          avatarUrl: player?.avatarfull || pref.avatarUrl || "",
          profileUrl: player?.profileurl || `https://steamcommunity.com/profiles/${pref.steamId}`,
          status: player?.personastate ? "En línea" : "Desconectado",
          playingGame: "",
          playingAppId: "",
          playingMinutes: 0,
          playingSpan: "",
          favorite: Boolean(pref.favorite),
          inviteGame: pref.inviteGame || "",
          messages: (pref.messages ?? []).slice(-20).map((message) => ({ text: message.text || "", at: message.at || 0 })),
        });
      }
    } else {
      for (const pref of steamExtras) {
        friends.push({
          steamId: pref.steamId,
          name: pref.name || "Amigo",
          avatarUrl: pref.avatarUrl || "",
          profileUrl: `https://steamcommunity.com/profiles/${pref.steamId}`,
          status: "Desconectado",
          playingGame: "",
          playingAppId: "",
          playingMinutes: 0,
          playingSpan: "",
          favorite: Boolean(pref.favorite),
          inviteGame: pref.inviteGame || "",
          messages: (pref.messages ?? []).slice(-20).map((message) => ({ text: message.text || "", at: message.at || 0 })),
        });
      }
    }
    for (const pref of extras.filter((item) => item.steamId.startsWith("user:"))) {
      friends.push({
        steamId: pref.steamId,
        name: pref.name || pref.username || "Amigo",
        avatarUrl: pref.avatarUrl || "",
        profileUrl: "",
        status: "En GameNow",
        playingGame: "",
        playingAppId: "",
        playingMinutes: 0,
        playingSpan: "",
        favorite: Boolean(pref.favorite),
        inviteGame: pref.inviteGame || "",
        messages: (pref.messages ?? []).slice(-20).map((message) => ({ text: message.text || "", at: message.at || 0 })),
      });
    }
    friends.sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        Number(Boolean(b.playingGame)) - Number(Boolean(a.playingGame)) ||
        a.name.localeCompare(b.name),
    );
    const steamIds = friends.map((friend) => friend.steamId).filter((id) => /^\d{17}$/.test(id));
    const localIds = friends
      .filter((friend) => friend.steamId.startsWith("user:"))
      .map((friend) => friend.steamId.slice(5));
    const [localBySteamList, localByIdList] = await Promise.all([
      steamIds.length
        ? User.find({ steamId: { $in: steamIds } })
            .select("steamId steamBackgroundUrl steamBackgroundVideo")
            .lean()
        : Promise.resolve([] as { steamId?: string; steamBackgroundUrl?: string; steamBackgroundVideo?: string }[]),
      localIds.length
        ? User.find({ _id: { $in: localIds } })
            .select("_id steamBackgroundUrl steamBackgroundVideo")
            .lean()
        : Promise.resolve([] as { _id: unknown; steamBackgroundUrl?: string; steamBackgroundVideo?: string }[]),
    ]);
    const localBySteam = new Map(localBySteamList.map((item) => [String(item.steamId), item]));
    const localById = new Map(localByIdList.map((item) => [String(item._id), item]));
    await Promise.all(
      friends.map(async (friend) => {
        if (friend.steamId.startsWith("user:")) {
          const local = localById.get(friend.steamId.slice(5));
          friend.backgroundUrl = local?.steamBackgroundUrl || "";
          friend.backgroundVideo = local?.steamBackgroundVideo || "";
          return;
        }
        const local = localBySteam.get(friend.steamId);
        let backgroundUrl = local?.steamBackgroundUrl || "";
        let backgroundVideo = local?.steamBackgroundVideo || "";
        if (!backgroundUrl && !backgroundVideo && /^\d{17}$/.test(friend.steamId)) {
          const background = await resolveSteamBackground(friend.steamId);
          backgroundUrl = background.image;
          backgroundVideo = background.video;
          if ((backgroundUrl || backgroundVideo) && local) {
            void User.updateOne(
              { steamId: friend.steamId },
              { $set: { steamBackgroundUrl: backgroundUrl, steamBackgroundVideo: backgroundVideo } },
            );
          }
        }
        friend.backgroundUrl = backgroundUrl;
        friend.backgroundVideo = backgroundVideo;
      }),
    );
    res.json({ friends, requests, linked, hidden });
  } catch (error) {
    console.error("Steam friends:", error instanceof Error ? error.message : error);
    res.status(502).json({ error: "No se pudo leer la lista de amigos." });
  }
}

export async function updateLibraryGame(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  const slug = typeof req.body?.slug === "string" ? req.body.slug : "";
  if (!slug) {
    res.status(400).json({ error: "Falta el juego." });
    return;
  }

  const set: Record<string, unknown> = {};
  if (req.body?.userRating !== undefined) {
    const rating = Number(req.body.userRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "La calificación debe ser de 1 a 5." });
      return;
    }
    set["steamGames.$.userRating"] = rating;
  }
  if (typeof req.body?.isInstalled === "boolean") {
    set["steamGames.$.isInstalled"] = req.body.isInstalled;
  }
  if (typeof req.body?.userNote === "string") {
    set["steamGames.$.userNote"] = req.body.userNote.trim().slice(0, 500);
  }
  if (typeof req.body?.desktopShortcut === "boolean") {
    set["steamGames.$.desktopShortcut"] = req.body.desktopShortcut;
  }
  if (typeof req.body?.taskbarPin === "boolean") {
    set["steamGames.$.taskbarPin"] = req.body.taskbarPin;
  }
  if (typeof req.body?.beta === "string") {
    const beta = req.body.beta;
    if (!["stable", "beta", "experimental", "previous"].includes(beta)) {
      res.status(400).json({ error: "Esa versión no está disponible." });
      return;
    }
    set["steamGames.$.beta"] = beta;
  }
  if (req.body?.remove === true) {
    const hasDb = await connectDb();
    if (!hasDb) {
      res.status(503).json({ error: "La base de datos no está disponible." });
      return;
    }
    const owner = await User.findById(userId);
    if (!owner) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }
    const target = owner.steamGames.find(
      (item) => item.slug === slug || (item.steamAppId && item.steamAppId === slug),
    );
    if (!target) {
      res.status(404).json({ error: "No se encontró el juego en tu biblioteca." });
      return;
    }
    // Guardar claves ocultas para que Steam sync no lo vuelva a meter
    const hideKeys = [target.slug, target.steamAppId, slug].filter(
      (key): key is string => Boolean(key && String(key).trim()),
    );
    const hidden = new Set([...(owner.hiddenLibraryKeys ?? []), ...hideKeys]);
    owner.hiddenLibraryKeys = [...hidden];
    owner.steamGames = owner.steamGames.filter(
      (item) => item.slug !== target.slug && item.steamAppId !== target.steamAppId,
    );
    owner.steamGameCount = owner.steamGames.length;
    await owner.save();
    res.json({ user: owner.toJSON() });
    return;
  }
  if (req.body?.sell === true) {
    const hasDb = await connectDb();
    if (!hasDb) {
      res.status(503).json({ error: "La base de datos no está disponible." });
      return;
    }
    const owner = await User.findById(userId);
    const owned = owner?.steamGames.find((item) => item.slug === slug);
    if (!owner || !owned?.purchased) {
      res.status(403).json({ error: "Solo puedes vender juegos de GameNow." });
      return;
    }
    if (owned.saleStatus === "pending") {
      res.status(409).json({ error: "Este juego ya está vendido. El pago a tu tarjeta sigue en espera." });
      return;
    }
    const payout = req.body?.payout === "card" ? "card" : req.body?.payout === "wallet" ? "wallet" : "";
    if (!payout) {
      res.status(400).json({ error: "Elige si el dinero va a tu cartera o a tu tarjeta." });
      return;
    }
    const paid = await purchasePrice(userId, slug, owned.paidPrice);
    if (paid > 0 && owned.paidPrice !== paid) owned.paidPrice = paid;
    const quote = await quoteResale(slug, owned.playTimeHours || 0, paid);
    if (!quote) {
      res.status(404).json({ error: "No guardamos el precio de tu compra, así que no podemos calcular el reembolso." });
      return;
    }
    if (payout === "card") {
      if (!/^\d{4}$/.test(owner.cardLast4 || "")) {
        res.status(400).json({ error: "No hay una tarjeta guardada para devolver el dinero." });
        return;
      }
      owned.saleStatus = "pending";
      owned.salePayout = quote.payout;
      await owner.save();
      res.json({ user: owner.toJSON(), resale: quote, payout: "card" });
      return;
    }
    owner.balance = Math.round(((owner.balance || 0) + quote.payout) * 100) / 100;
    await recordTrade(slug, "sell", userId, quote.payout);
    if ((owned.playTimeHours || 0) > 0) {
      owned.purchased = false;
    } else {
      owner.steamGames = owner.steamGames.filter((item) => item.slug !== slug);
    }
    await owner.save();
    res.json({ user: owner.toJSON(), resale: quote, payout: "wallet" });
    return;
  }
  if (!Object.keys(set).length) {
    res.status(400).json({ error: "No hay cambios." });
    return;
  }

  const hasDb = await connectDb();
  if (!hasDb) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return;
  }
  const user = await User.findOneAndUpdate({ _id: userId, "steamGames.slug": slug }, { $set: set }, { new: true });
  if (!user) {
    res.status(404).json({ error: "No se encontró el juego en tu biblioteca." });
    return;
  }
  res.json({ user: user.toJSON() });
}

function boughtGame(slug: string, name: string, cover: string, steamAppId: string, coverFallback: string): SteamLibraryGame {
  const cyberpunkBanner =
    "https://res.cloudinary.com/fj6z6mba/image/upload/f_auto,q_auto:best,dpr_auto,c_limit,g_center,w_1440/gamenow/presskit/cp-home";
  const banner =
    steamAppId === "1091500" || slug === "cyberpunk-2077"
      ? cyberpunkBanner
      : steamAppId
        ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/header.jpg`
        : cover;
  const artCover =
    steamAppId === "2138330" || slug.includes("phantom-liberty")
      ? "https://res.cloudinary.com/fj6z6mba/image/upload/f_auto,q_auto:best,dpr_auto,c_limit,g_center,w_1440/gamenow/presskit/cp-liberty"
      : cover || coverFallback;
  return {
    slug,
    steamAppId,
    name,
    cover: artCover,
    coverSrcSet: "",
    coverFallback: coverFallback || artCover,
    banner,
    miniIcon: steamAppId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/capsule_sm_120.jpg` : "",
    genre: "Aventura",
    lastPlayed: "Hoy",
    lastPlayedTimestamp: Date.now(),
    playTimeHours: 0,
    isInstalled: false,
    isFavorite: false,
    purchased: true,
  };
}

/** Agrega a la biblioteca los juegos pagados en la tienda. */
export async function purchaseLibrary(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  const fromItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const purchases = (fromItems.length ? fromItems : (Array.isArray(req.body?.slugs) ? req.body.slugs : []).map((slug: unknown) => ({ slug })))
    .map((item: { slug?: unknown; price?: unknown }) => ({
      slug: typeof item?.slug === "string" ? item.slug : typeof item === "string" ? item : "",
      price: Number(typeof item === "object" && item ? item.price : NaN),
    }))
    .filter((item: { slug: string }) => /^[a-z0-9-]{2,80}$/.test(item.slug))
    .slice(0, 20);
  if (!purchases.length) {
    res.status(400).json({ error: "Falta el juego." });
    return;
  }
  const hasDb = await connectDb();
  if (!hasDb) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return;
  }
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  const method = req.body?.method === "wallet" ? "wallet" : "card";
  const catalog = await loadGames();
  const known = new Map(catalog.games.map((game) => [game.slug, game]));
  const products = new Map((await loadProducts()).map((product) => [product.slug, product]));
  const now = Date.now();
  const ready: { slug: string; name: string; cover: string; steamAppId: string; coverFallback: string; catalogPrice: number; already: boolean }[] = [];
  for (const item of purchases) {
    const source = known.get(item.slug);
    const product = products.get(item.slug);
    const productPrice = product ? await toMxn(product.price, product.currency || "MXN") : 0;
    const catalogPrice = Math.round((productPrice || source?.priceValue || 0) * 100) / 100;
    const name = product?.name || source?.name || item.slug;
    if (!catalogPrice) {
      res.status(404).json({ error: "Ese juego no está en la tienda." });
      return;
    }
    const paid = Number.isFinite(item.price) && item.price > 0 ? Math.round(item.price * 100) / 100 : catalogPrice;
    if (Math.abs(paid - catalogPrice) > 0.01) {
      res.status(409).json({ error: `El precio de ${name} cambió. Vuelve al carrito e inténtalo de nuevo.` });
      return;
    }
    const owned = user.steamGames.find((game) => game.slug === item.slug);
    ready.push({
      slug: item.slug,
      name,
      cover: source?.cover || product?.cover.local || "",
      steamAppId: source?.steamAppId || "",
      coverFallback: source?.coverFallback || source?.cover || product?.cover.local || "",
      catalogPrice,
      already: Boolean(owned?.purchased),
    });
  }
  const charge = Math.round(ready.reduce((sum, item) => sum + (item.already ? 0 : item.catalogPrice), 0) * 100) / 100;
  if (method === "wallet") {
    const balance = Math.round((user.balance || 0) * 100) / 100;
    if (balance + 0.001 < charge) {
      res.status(402).json({
        error: `Tu saldo es ${formatMxn(balance)} y este pedido cuesta ${formatMxn(charge)}.`,
      });
      return;
    }
    user.balance = Math.round((balance - charge) * 100) / 100;
  }
  for (const item of ready) {
    const current = user.steamGames.find((game) => game.slug === item.slug);
    if (current) {
      if (!current.purchased) {
        current.paidPrice = item.catalogPrice;
        await recordTrade(item.slug, "buy", userId, item.catalogPrice);
      }
      current.purchased = true;
      current.lastPlayed = "Hoy";
      current.lastPlayedTimestamp = now;
      if (!current.banner && item.steamAppId) {
        current.banner = `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamAppId}/header.jpg`;
      }
      continue;
    }
    const bought = boughtGame(item.slug, item.name, item.cover, item.steamAppId, item.coverFallback);
    bought.paidPrice = item.catalogPrice;
    user.steamGames.unshift(bought);
    await recordTrade(item.slug, "buy", userId, item.catalogPrice);
  }
  const last4 = method === "card" && typeof req.body?.cardLast4 === "string" ? req.body.cardLast4.replace(/\D/g, "").slice(-4) : "";
  if (/^\d{4}$/.test(last4)) user.cardLast4 = last4;
  await user.save();
  res.json({ user: user.toJSON() });
}

function friendKey(value: string) {
  const raw = value.trim();
  if (/^user:[a-f0-9]{24}$/i.test(raw)) return raw.toLowerCase();
  const digits = raw.replace(/\D/g, "");
  return /^\d{17}$/.test(digits) ? digits : "";
}

export async function searchPeople(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2) {
    res.json({ people: [] });
    return;
  }
  const hasDb = await connectDb();
  if (!hasDb) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return;
  }
  const me = await User.findById(userId).select("steamId friendPrefs");
  if (!me) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  const known = new Set(
    (me.friendPrefs ?? []).filter((pref) => pref.added && !pref.hidden).map((pref) => pref.steamId),
  );
  if (me.steamId) {
    const steamFriends = await friendIds(me.steamId);
    for (const id of steamFriends) known.add(id);
  }

  type PersonResult = {
    steamId: string;
    name: string;
    avatarUrl: string;
    username: string;
    alreadyFriend: boolean;
    source: "gamenow" | "steam";
    miniBackgroundUrl: string;
    miniBackgroundVideo: string;
  };
  const people: PersonResult[] = [];
  const seen = new Set<string>();

  const pushPerson = async (person: Omit<PersonResult, "miniBackgroundUrl" | "miniBackgroundVideo">) => {
    if (seen.has(person.steamId) || (me.steamId && person.steamId === me.steamId)) return;
    seen.add(person.steamId);
    let miniBackgroundUrl = "";
    let miniBackgroundVideo = "";
    if (/^\d{17}$/.test(person.steamId)) {
      const mini = await resolveSteamMiniBackground(person.steamId);
      miniBackgroundUrl = mini.image;
      miniBackgroundVideo = mini.video;
    }
    people.push({ ...person, miniBackgroundUrl, miniBackgroundVideo });
  };

  let steamId = friendKey(query);
  if (!steamId && config.steamApiKey && !query.includes(" ")) {
    const vanity = await steamJson<{ response?: { success?: number; steamid?: string } }>(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(config.steamApiKey)}&vanityurl=${encodeURIComponent(query)}`,
    );
    if (vanity?.response?.success === 1 && vanity.response.steamid) {
      steamId = vanity.response.steamid;
    }
  }

  if (/^\d{17}$/.test(steamId) && steamId !== me.steamId) {
    const key = encodeURIComponent(config.steamApiKey);
    const summary = await steamJson<{
      response?: { players?: { steamid: string; personaname?: string; avatarfull?: string }[] };
    }>(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${steamId}`);
    const player = summary?.response?.players?.[0];
    if (player) {
      const local = await User.findOne({ steamId: player.steamid }).select("username").lean();
      await pushPerson({
        steamId: player.steamid,
        name: player.personaname || "Jugador de Steam",
        avatarUrl: player.avatarfull || "",
        username: local?.username || "",
        alreadyFriend: known.has(player.steamid),
        source: local ? "gamenow" : "steam",
      });
    }
  }

  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const users = await User.find({
    _id: { $ne: userId },
    $or: [{ username: { $regex: safe, $options: "i" } }, { steamName: { $regex: safe, $options: "i" } }],
  })
    .select("username avatarUrl steamId steamName steamAvatarUrl")
    .limit(10);
  for (const person of users) {
    const id = person.steamId || `user:${person.id}`;
    await pushPerson({
      steamId: id,
      name: person.steamName || person.username,
      avatarUrl: person.steamAvatarUrl || person.avatarUrl || "",
      username: person.username,
      alreadyFriend: known.has(id) || Boolean(person.steamId && known.has(person.steamId)),
      source: "gamenow",
    });
  }

  res.json({ people });
}

export async function addFriend(req: Request, res: Response) {
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
  const me = await User.findById(userId).select(
    "friendPrefs steamId username steamName steamAvatarUrl avatarUrl incomingFriendRequests",
  );
  if (!me) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  let steamId = friendKey(typeof req.body?.steamId === "string" ? req.body.steamId : "");
  let name = "";
  let avatarUrl = "";
  let username = "";
  let targetUser: Awaited<ReturnType<typeof User.findById>> | null = null;

  if (!steamId && typeof req.body?.username === "string") {
    targetUser = await User.findOne({ username: req.body.username.trim() }).select(
      "username avatarUrl steamId steamName steamAvatarUrl friendPrefs incomingFriendRequests",
    );
    if (!targetUser || String(targetUser._id) === userId) {
      res.status(404).json({ error: "No encontramos a esa persona en GameNow." });
      return;
    }
    steamId = targetUser.steamId || `user:${targetUser.id}`;
    name = targetUser.steamName || targetUser.username;
    avatarUrl = targetUser.steamAvatarUrl || targetUser.avatarUrl || "";
    username = targetUser.username;
  }
  if (!steamId || steamId === me.steamId || steamId === `user:${userId}`) {
    res.status(400).json({ error: "Escribe un usuario de GameNow o un SteamID." });
    return;
  }
  if (!targetUser) {
    if (steamId.startsWith("user:")) {
      targetUser = await User.findById(steamId.slice(5)).select(
        "username avatarUrl steamId steamName steamAvatarUrl friendPrefs incomingFriendRequests",
      );
    } else if (/^\d{17}$/.test(steamId)) {
      targetUser = await User.findOne({ steamId }).select(
        "username avatarUrl steamId steamName steamAvatarUrl friendPrefs incomingFriendRequests",
      );
    }
    if (targetUser) {
      name = targetUser.steamName || targetUser.username || name;
      avatarUrl = targetUser.steamAvatarUrl || targetUser.avatarUrl || avatarUrl;
      username = targetUser.username || username;
      steamId = targetUser.steamId || `user:${targetUser.id}`;
    }
  }
  if (!name && /^\d{17}$/.test(steamId)) {
    const key = encodeURIComponent(config.steamApiKey);
    const summary = await steamJson<{
      response?: { players?: { personaname?: string; avatarfull?: string }[] };
    }>(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${steamId}`);
    const player = summary?.response?.players?.[0];
    name = player?.personaname || "Jugador de Steam";
    avatarUrl = player?.avatarfull || "";
  }

  const prefs = me.friendPrefs ?? [];
  let current = prefs.find((item) => item.steamId === steamId);
  if (current && !current.hidden && current.added && !current.outgoing) {
    res.status(409).json({ error: "Esa persona ya está en tus amigos." });
    return;
  }
  if (current?.outgoing) {
    res.status(409).json({ error: "Ya enviaste una solicitud a esa persona." });
    return;
  }

  const myKey = me.steamId || `user:${userId}`;
  const myName = me.steamName || me.username || "Jugador";
  const myAvatar = me.steamAvatarUrl || me.avatarUrl || "";

  // Cuenta GameNow: solicitud pendiente (aceptar / rechazar)
  if (targetUser) {
    const theirIncoming = targetUser.incomingFriendRequests ?? [];
    if (theirIncoming.some((item) => item.fromUserId === userId || item.steamId === myKey)) {
      res.status(409).json({ error: "Ya enviaste una solicitud a esa persona." });
      return;
    }
    // Si ellos ya me enviaron solicitud, aceptar automáticamente
    const mutual = (me.incomingFriendRequests ?? []).find(
      (item) => item.fromUserId === String(targetUser!._id) || item.steamId === steamId,
    );
    if (mutual) {
      await acceptFriendPair(me, targetUser, steamId, {
        name: name || targetUser.steamName || targetUser.username,
        avatarUrl: avatarUrl || targetUser.steamAvatarUrl || targetUser.avatarUrl || "",
        username: username || targetUser.username || "",
      });
      res.json({
        steamId,
        name: name || targetUser.steamName || targetUser.username,
        avatarUrl: avatarUrl || targetUser.steamAvatarUrl || targetUser.avatarUrl || "",
        username: username || targetUser.username || "",
        status: "accepted",
      });
      return;
    }

    if (!current) {
      current = { steamId, favorite: false, hidden: false, inviteGame: "", messages: [] };
      prefs.push(current);
    }
    current.hidden = false;
    current.added = false;
    current.outgoing = true;
    current.name = name || current.name || "";
    current.avatarUrl = avatarUrl || current.avatarUrl || "";
    current.username = username || current.username || "";
    me.friendPrefs = prefs;
    theirIncoming.push({
      fromUserId: userId,
      steamId: myKey,
      name: myName,
      avatarUrl: myAvatar,
      username: me.username || "",
      at: Date.now(),
    });
    targetUser.incomingFriendRequests = theirIncoming;
    await Promise.all([me.save(), targetUser.save()]);
    res.json({
      steamId,
      name: current.name,
      avatarUrl: current.avatarUrl,
      username: current.username,
      status: "pending",
    });
    return;
  }

  // Solo Steam (sin cuenta GameNow): se agrega directo a la lista
  if (!current) {
    current = { steamId, favorite: false, hidden: false, inviteGame: "", messages: [] };
    prefs.push(current);
  }
  current.hidden = false;
  current.added = true;
  current.outgoing = false;
  current.name = name || current.name || "";
  current.avatarUrl = avatarUrl || current.avatarUrl || "";
  current.username = username || current.username || "";
  me.friendPrefs = prefs;
  await me.save();
  res.json({
    steamId,
    name: current.name,
    avatarUrl: current.avatarUrl,
    username: current.username,
    status: "added",
  });
}

async function acceptFriendPair(
  me: InstanceType<typeof User>,
  other: InstanceType<typeof User>,
  theirKey: string,
  theirMeta: { name: string; avatarUrl: string; username: string },
) {
  const myKey = me.steamId || `user:${me.id}`;
  const myMeta = {
    name: me.steamName || me.username || "Jugador",
    avatarUrl: me.steamAvatarUrl || me.avatarUrl || "",
    username: me.username || "",
  };

  const upsertFriend = (
    owner: InstanceType<typeof User>,
    key: string,
    meta: { name: string; avatarUrl: string; username: string },
  ) => {
    const prefs = owner.friendPrefs ?? [];
    let row = prefs.find((item) => item.steamId === key);
    if (!row) {
      row = { steamId: key, favorite: false, hidden: false, inviteGame: "", messages: [] };
      prefs.push(row);
    }
    row.hidden = false;
    row.added = true;
    row.outgoing = false;
    row.name = meta.name || row.name || "";
    row.avatarUrl = meta.avatarUrl || row.avatarUrl || "";
    row.username = meta.username || row.username || "";
    owner.friendPrefs = prefs;
  };

  upsertFriend(me, theirKey, theirMeta);
  upsertFriend(other, myKey, myMeta);
  me.incomingFriendRequests = (me.incomingFriendRequests ?? []).filter(
    (item) => item.fromUserId !== String(other._id) && item.steamId !== theirKey,
  );
  other.incomingFriendRequests = (other.incomingFriendRequests ?? []).filter(
    (item) => item.fromUserId !== String(me._id) && item.steamId !== myKey,
  );
  await Promise.all([me.save(), other.save()]);
}

export async function resaleQuote(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) {
    res.status(400).json({ error: "Falta el juego." });
    return;
  }
  const hasDb = await connectDb();
  if (!hasDb) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return;
  }
  const owner = await User.findById(userId).select("steamGames balance");
  const owned = owner?.steamGames.find((item) => item.slug === slug);
  if (!owned?.purchased) {
    res.status(403).json({ error: "Solo puedes vender juegos de GameNow." });
    return;
  }
  const paid = await purchasePrice(userId, slug, owned.paidPrice);
  const quote = await quoteResale(slug, owned.playTimeHours || 0, paid);
  if (!quote) {
    res.status(404).json({ error: "No guardamos el precio de tu compra, así que no podemos calcular el reembolso." });
    return;
  }
  res.json({ resale: quote, balance: owner?.balance || 0 });
}

export async function updateFriend(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  const steamId = friendKey(typeof req.body?.steamId === "string" ? req.body.steamId : "");
  if (!steamId) {
    res.status(400).json({ error: "Falta el amigo." });
    return;
  }

  const hasDb = await connectDb();
  if (!hasDb) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return;
  }
  const user = await User.findById(userId).select(
    "friendPrefs steamId username steamName steamAvatarUrl avatarUrl incomingFriendRequests",
  );
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  const action = typeof req.body?.action === "string" ? req.body.action : "";
  if (action === "accept" || action === "reject") {
    const incoming = user.incomingFriendRequests ?? [];
    const request = incoming.find((item) => item.steamId === steamId || item.fromUserId === steamId.replace(/^user:/, ""));
    if (!request) {
      res.status(404).json({ error: "No hay solicitud de esa persona." });
      return;
    }
    if (action === "reject") {
      user.incomingFriendRequests = incoming.filter(
        (item) => item.steamId !== request.steamId && item.fromUserId !== request.fromUserId,
      );
      if (request.fromUserId) {
        const other = await User.findById(request.fromUserId).select("friendPrefs");
        if (other) {
          const myKey = user.steamId || `user:${userId}`;
          other.friendPrefs = (other.friendPrefs ?? []).filter(
            (item) => !(item.outgoing && (item.steamId === myKey || item.steamId === steamId)),
          );
          await other.save();
        }
      }
      await user.save();
      res.json({ steamId: request.steamId, status: "rejected" });
      return;
    }

    let other = request.fromUserId ? await User.findById(request.fromUserId) : null;
    if (!other && /^\d{17}$/.test(request.steamId)) {
      other = await User.findOne({ steamId: request.steamId });
    }
    if (!other && request.steamId.startsWith("user:")) {
      other = await User.findById(request.steamId.slice(5));
    }
    if (!other) {
      res.status(404).json({ error: "Esa cuenta ya no existe." });
      return;
    }
    const theirKey = other.steamId || `user:${other.id}`;
    await acceptFriendPair(user, other, theirKey, {
      name: request.name || other.steamName || other.username,
      avatarUrl: request.avatarUrl || other.steamAvatarUrl || other.avatarUrl || "",
      username: request.username || other.username || "",
    });
    res.json({
      steamId: theirKey,
      name: request.name || other.steamName || other.username,
      avatarUrl: request.avatarUrl || other.steamAvatarUrl || other.avatarUrl || "",
      username: request.username || other.username || "",
      status: "accepted",
      favorite: false,
      hidden: false,
      inviteGame: "",
      messages: [],
    });
    return;
  }

  const prefs = user.friendPrefs ?? [];
  let current = prefs.find((item) => item.steamId === steamId);
  if (!current) {
    current = { steamId, favorite: false, hidden: false, inviteGame: "", messages: [] };
    prefs.push(current);
  }
  if (typeof req.body?.favorite === "boolean") current.favorite = req.body.favorite;
  if (typeof req.body?.hidden === "boolean") current.hidden = req.body.hidden;
  if (typeof req.body?.inviteGame === "string") current.inviteGame = req.body.inviteGame.trim().slice(0, 80);
  if (typeof req.body?.message === "string" && req.body.message.trim()) {
    current.messages = [...(current.messages ?? []), { text: req.body.message.trim().slice(0, 280), at: Date.now() }].slice(-20);
  }
  user.friendPrefs = prefs;
  await user.save();
  res.json({
    steamId,
    favorite: Boolean(current.favorite),
    hidden: Boolean(current.hidden),
    inviteGame: current.inviteGame || "",
    messages: (current.messages ?? []).map((message) => ({ text: message.text || "", at: message.at || 0 })),
  });
}

async function friendIds(steamId: string) {
  const cached = friendIdCache.get(steamId);
  if (cached && Date.now() - cached.at < 2 * 60 * 1000) return cached.ids;
  const key = encodeURIComponent(config.steamApiKey);
  const list = await steamJson<{ friendslist?: { friends?: { steamid: string }[] } }>(
    `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${steamId}&relationship=friend`,
  );
  if (!list?.friendslist) return new Set<string>();
  const ids = new Set((list.friendslist.friends ?? []).map((friend) => friend.steamid));
  friendIdCache.set(steamId, { at: Date.now(), ids });
  return ids;
}

function viewerRelation(
  viewer: { steamId?: string; friendPrefs?: { steamId: string; favorite?: boolean; inviteGame?: string; messages?: { text?: string; at?: number }[] }[] },
  steamId: string,
) {
  if (viewer.steamId === steamId) return null;
  const pref = (viewer.friendPrefs ?? []).find((item) => item.steamId === steamId);
  return {
    favorite: Boolean(pref?.favorite),
    inviteGame: pref?.inviteGame || "",
    messages: (pref?.messages ?? []).slice(-20).map((message) => ({ text: message.text || "", at: message.at || 0 })),
  };
}

function publicGame(game: {
  slug: string;
  steamAppId: string;
  name: string;
  cover: string;
  coverFallback: string;
  genre: string;
  lastPlayed: string;
  lastPlayedTimestamp: number;
  playTimeHours: number;
}) {
  return {
    slug: game.slug,
    steamAppId: game.steamAppId,
    name: game.name,
    cover: game.cover,
    coverFallback: game.coverFallback,
    genre: game.genre,
    lastPlayed: game.lastPlayed,
    lastPlayedTimestamp: game.lastPlayedTimestamp,
    playTimeHours: game.playTimeHours,
  };
}

/** Perfil de un amigo: GameNow si la cuenta existe, si no el perfil público de Steam. */
export async function steamProfile(req: Request, res: Response) {
  const rawId = decodeURIComponent(String(req.params.steamId || ""));
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

  const viewer = await User.findById(userId).select("steamId friendPrefs");
  if (!viewer) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  // Perfil GameNow por user:ObjectId
  if (rawId.startsWith("user:") || (/^[a-f\d]{24}$/i.test(rawId) && !/^\d{17}$/.test(rawId))) {
    const targetId = rawId.startsWith("user:") ? rawId.slice(5) : rawId;
    if (!Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ error: "Perfil no válido." });
      return;
    }
    const member = await User.findById(targetId).select(
      "username steamId steamName steamAvatarUrl avatarUrl steamFrameUrl steamBackgroundUrl steamBackgroundVideo steamGameCount steamGames",
    );
    if (!member) {
      res.status(404).json({ error: "No se encontró ese perfil." });
      return;
    }
    const key = member.steamId || `user:${member.id}`;
    const library = member.steamGames ?? [];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const games = library
      .filter((game) => game.lastPlayedTimestamp >= weekAgo)
      .sort((a, b) => b.lastPlayedTimestamp - a.lastPlayedTimestamp)
      .map(publicGame);
    const totalHours = Math.round(library.reduce((sum, game) => sum + (game.playTimeHours || 0), 0));
    res.json({
      kind: "gamenow",
      steamId: key,
      name: member.username,
      steamName: member.steamName || "",
      avatarUrl: member.steamAvatarUrl || member.avatarUrl || "",
      frameUrl: member.steamFrameUrl || "",
      backgroundUrl: member.steamBackgroundUrl || "",
      backgroundVideo: member.steamBackgroundVideo || "",
      gameCount: member.steamGameCount || library.length,
      totalHours,
      games,
      relation: viewerRelation(viewer, key),
    });
    return;
  }

  const steamId = rawId;
  if (!/^\d{17}$/.test(steamId)) {
    res.status(400).json({ error: "Perfil no válido." });
    return;
  }

  if (viewer.steamId && viewer.steamId !== steamId) {
    const ids = await friendIds(viewer.steamId);
    const pref = (viewer.friendPrefs ?? []).find((item) => item.steamId === steamId && item.added && !item.hidden);
    if (!ids.has(steamId) && !pref) {
      res.status(404).json({ error: "No se encontró ese perfil." });
      return;
    }
  } else if (!viewer.steamId) {
    const pref = (viewer.friendPrefs ?? []).find((item) => item.steamId === steamId && item.added && !item.hidden);
    if (!pref) {
      const memberCheck = await User.findOne({ steamId }).select("_id");
      if (!memberCheck) {
        res.status(404).json({ error: "No se encontró ese perfil." });
        return;
      }
    }
  }

  const member = await User.findOne({ steamId }).select(
    "username steamName steamAvatarUrl steamFrameUrl steamBackgroundUrl steamBackgroundVideo steamGameCount steamGames avatarUrl",
  );
  if (member) {
    const library = member.steamGames ?? [];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const games = library
      .filter((game) => game.lastPlayedTimestamp >= weekAgo)
      .sort((a, b) => b.lastPlayedTimestamp - a.lastPlayedTimestamp)
      .map(publicGame);
    const totalHours = Math.round(library.reduce((sum, game) => sum + (game.playTimeHours || 0), 0));
    let backgroundUrl = member.steamBackgroundUrl || "";
    let backgroundVideo = member.steamBackgroundVideo || "";
    if (!backgroundUrl && !backgroundVideo) {
      const background = await resolveSteamBackground(steamId);
      backgroundUrl = background.image;
      backgroundVideo = background.video;
      if (backgroundUrl || backgroundVideo) {
        void User.updateOne(
          { _id: member._id },
          { $set: { steamBackgroundUrl: backgroundUrl, steamBackgroundVideo: backgroundVideo } },
        );
      }
    }
    res.json({
      kind: "gamenow",
      steamId,
      name: member.username,
      steamName: member.steamName || "",
      avatarUrl: member.steamAvatarUrl || member.avatarUrl || "",
      frameUrl: member.steamFrameUrl || "",
      backgroundUrl,
      backgroundVideo,
      gameCount: member.steamGameCount || library.length,
      totalHours,
      games,
      relation: viewerRelation(viewer, steamId),
    });
    return;
  }

  const relation = viewerRelation(viewer, steamId);
  const cached = visitCache.get(steamId);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
    res.json({ ...cached.profile, relation });
    return;
  }
  try {
    const profile = await loadSteamVisit(steamId);
    visitCache.set(steamId, { at: Date.now(), profile });
    res.json({ ...profile, relation });
  } catch (error) {
    console.error("Steam profile:", error instanceof Error ? error.message : error);
    res.status(404).json({ error: "Steam no publicó este perfil." });
  }
}
