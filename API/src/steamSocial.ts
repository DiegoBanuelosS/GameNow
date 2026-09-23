import { Request, Response } from "express";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { verifyJwt } from "./auth.js";
import { User } from "./models/User.js";
import { loadGames } from "./games.js";
import { loadSteamVisit, type SteamLibraryGame } from "./steamSync.js";

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
  const user = await User.findById(userId).select("steamId friendPrefs");
  if (!user?.steamId) {
    res.json({ friends: [], linked: false });
    return;
  }

  try {
    const key = encodeURIComponent(config.steamApiKey);
    const list = await steamJson<{ friendslist?: { friends?: { steamid: string }[] } }>(
      `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${user.steamId}&relationship=friend`,
    );
    const ids = (list?.friendslist?.friends ?? []).map((friend) => friend.steamid).filter(Boolean);
    if (!list?.friendslist) {
      res.json({ friends: [], linked: true, hidden: true });
      return;
    }

    const prefs = new Map((user.friendPrefs ?? []).map((item) => [item.steamId, item]));
    const friends: Friend[] = [];
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
    friends.sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        Number(Boolean(b.playingGame)) - Number(Boolean(a.playingGame)) ||
        a.name.localeCompare(b.name),
    );
    res.json({ friends, linked: true, hidden: false });
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
    if ((owned.playTimeHours || 0) > 0) {
      owned.purchased = false;
    } else {
      owner.steamGames = owner.steamGames.filter((item) => item.slug !== slug);
    }
    await owner.save();
    res.json({ user: owner.toJSON() });
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
  const banner = steamAppId
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/header.jpg`
    : cover;
  return {
    slug,
    steamAppId,
    name,
    cover: cover || coverFallback,
    coverSrcSet: "",
    coverFallback: coverFallback || cover,
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
  const slugs = (Array.isArray(req.body?.slugs) ? req.body.slugs : [])
    .filter((slug: unknown): slug is string => typeof slug === "string" && /^[a-z0-9-]{2,80}$/.test(slug))
    .slice(0, 20);
  if (!slugs.length) {
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
  const catalog = await loadGames();
  const known = new Map(catalog.games.map((game) => [game.slug, game]));
  const now = Date.now();
  for (const slug of slugs) {
    const source = known.get(slug);
    const current = user.steamGames.find((game) => game.slug === slug);
    if (current) {
      current.purchased = true;
      current.lastPlayed = "Hoy";
      current.lastPlayedTimestamp = now;
      if (!current.banner && source?.steamAppId) {
        current.banner = `https://cdn.cloudflare.steamstatic.com/steam/apps/${source.steamAppId}/header.jpg`;
      }
      continue;
    }
    user.steamGames.unshift(
      boughtGame(slug, source?.name || slug, source?.cover || "", source?.steamAppId || "", source?.coverFallback || ""),
    );
  }
  await user.save();
  res.json({ user: user.toJSON() });
}

export async function updateFriend(req: Request, res: Response) {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  const steamId = typeof req.body?.steamId === "string" ? req.body.steamId.replace(/\D/g, "") : "";
  if (!steamId) {
    res.status(400).json({ error: "Falta el amigo." });
    return;
  }

  const hasDb = await connectDb();
  if (!hasDb) {
    res.status(503).json({ error: "La base de datos no está disponible." });
    return;
  }
  const user = await User.findById(userId).select("friendPrefs");
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado." });
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
  const steamId = String(req.params.steamId || "");
  if (!/^\d{17}$/.test(steamId)) {
    res.status(400).json({ error: "Perfil no válido." });
    return;
  }
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
  if (!viewer?.steamId) {
    res.status(404).json({ error: "No hay una cuenta de Steam vinculada." });
    return;
  }
  if (viewer.steamId !== steamId) {
    const ids = await friendIds(viewer.steamId);
    if (!ids.has(steamId)) {
      res.status(404).json({ error: "No se encontró ese perfil." });
      return;
    }
  }

  const member = await User.findOne({ steamId }).select(
    "username steamName steamAvatarUrl steamFrameUrl steamBackgroundUrl steamBackgroundVideo steamGameCount steamGames",
  );
  if (member) {
    const library = member.steamGames ?? [];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const games = library
      .filter((game) => game.lastPlayedTimestamp >= weekAgo)
      .sort((a, b) => b.lastPlayedTimestamp - a.lastPlayedTimestamp)
      .map(publicGame);
    const totalHours = Math.round(library.reduce((sum, game) => sum + (game.playTimeHours || 0), 0));
    res.json({
      kind: "gamenow",
      steamId,
      name: member.username,
      steamName: member.steamName || "",
      avatarUrl: member.steamAvatarUrl || "",
      frameUrl: member.steamFrameUrl || "",
      backgroundUrl: member.steamBackgroundUrl || "",
      backgroundVideo: member.steamBackgroundVideo || "",
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
