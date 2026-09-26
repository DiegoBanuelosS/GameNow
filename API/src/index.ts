import cors from "cors";
import express from "express";
import { loadProduct, loadStore } from "./catalog.js";
import { loadAppTitle, loadReleases } from "./releases.js";
import { loadSimilar } from "./similar.js";
import { loadGame, loadGames, loadGamesPage } from "./games.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { fitPc } from "./pcFit.js";
import { windowsInstallerPath, windowsAppZipPath, windowsPackagePath } from "./download.js";
import { cachedVideoPath, videoContentType } from "./videoCache.js";
import { getReviews, addReview, markHelpful, userOwnsGame } from "./reviews.js";
import { authRouter, verifyJwt } from "./auth.js";
import { chatRouter } from "./chat.js";
import { steamCallback, steamRefresh, steamStart, steamUnlink } from "./steamLink.js";
import { addFriend, purchaseLibrary, resaleQuote, searchPeople, steamAchievements, steamFriends, steamProfile, updateFriend, updateLibraryGame } from "./steamSocial.js";
import { loadSteamNewsForApps } from "./steamNews.js";
import { submitSupport } from "./support.js";
import { User } from "./models/User.js";

const app = express();
app.use(
  cors({
    origin(origin, next) {
      if (!origin) {
        next(null, true);
        return;
      }
      let host = "";
      try {
        host = new URL(origin).hostname;
      } catch {
        host = "";
      }
      if (
        origin === config.wwwOrigin ||
        host.endsWith(".pages.dev") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.startsWith("http://localhost:")
      ) {
        next(null, true);
        return;
      }
      next(null, false);
    },
  }),
);
app.use(express.json());

// Callback de OpenID fuera del límite de login para que Steam pueda volver
app.get("/api/auth/steam/callback", steamCallback);

// Autenticación segura con MongoDB
app.use("/api/auth", authRouter);
authRouter.get("/steam/start", steamStart);
authRouter.post("/steam/refresh", steamRefresh);
authRouter.delete("/steam", steamUnlink);

app.use("/api/chat", chatRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/steam/achievements/:appId", steamAchievements);
app.get("/api/steam/friends", steamFriends);
app.get("/api/steam/people", searchPeople);
app.post("/api/steam/friends", addFriend);
app.get("/api/steam/profile/:steamId", steamProfile);
app.get("/api/library/resale", resaleQuote);
app.patch("/api/steam/friends", updateFriend);
app.patch("/api/steam/library", updateLibraryGame);
app.post("/api/steam/library", purchaseLibrary);
app.post("/api/support", submitSupport);

app.get("/api/store", async (_req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.json(await loadStore());
  } catch (error) {
    res.status(500).json({ error: "No se pudo cargar la tienda." });
    console.error(error);
  }
});

app.get("/api/similar/:appId", async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    const genre = typeof req.query.genre === "string" ? req.query.genre : "";
    res.json({ games: await loadSimilar(req.params.appId, genre) });
  } catch (error) {
    res.status(500).json({ error: "No se pudieron cargar juegos parecidos." });
    console.error(error);
  }
});

app.get("/api/title/:appId", async (req, res) => {
  try {
    const title = await loadAppTitle(req.params.appId);
    if (!title) {
      res.status(404).json({ error: "No está en la tienda." });
      return;
    }
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    res.json(title);
  } catch (error) {
    res.status(500).json({ error: "No se pudo cargar el juego." });
    console.error(error);
  }
});

app.get("/api/releases", async (_req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    res.json(await loadReleases());
  } catch (error) {
    res.status(500).json({ error: "No se pudo cargar el calendario de lanzamientos." });
    console.error(error);
  }
});

app.get("/api/games", async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    if (req.query.set === "known") {
      res.json(await loadGames());
      return;
    }
    const page = Number(req.query.page) || 1;
    const min = req.query.min == null ? undefined : Number(req.query.min);
    const max = req.query.max == null ? undefined : Number(req.query.max);
    const stars = Number(req.query.stars) || 0;
    res.json(
      await loadGamesPage({
        page,
        tab: typeof req.query.tab === "string" ? req.query.tab : undefined,
        min: Number.isFinite(min) ? min : undefined,
        max: Number.isFinite(max) ? max : undefined,
        stars,
        q: typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : undefined,
      }),
    );
  } catch (error) {
    res.status(500).json({ error: "No se pudo cargar Nuestros Juegos." });
    console.error(error);
  }
});

app.get("/api/news", async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");

    const curated = [
      {
        id: "bg3-patch-7",
        game: "Baldur's Gate 3",
        appId: "1086940",
        slug: "baldurs-gate-3",
        title: "Parche 7 ya disponible: Nuevas cinemáticas de finales oscuros y soporte oficial para mods",
        author: "Larian Studios",
        date: "18 de sep 2026",
        dateTs: Date.parse("2026-09-18") / 1000,
        url: "https://store.steampowered.com/news/app/1086940",
        snippet:
          "Larian Studios introduce 13 cinemáticas nuevas para las rutas de conquista absoluta, gestor integrado de mods y pantalla dividida perfeccionada.",
        body:
          "<p>Larian Studios introduce 13 cinemáticas nuevas para las rutas de conquista absoluta, gestor integrado de mods y pantalla dividida perfeccionada.</p><p>El Parche 7 también amplía el soporte de mods oficiales y mejora la estabilidad en pantallas ultraanchas.</p>",
        image:
          "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_75e07a34e0a6d59b2075a898b958c8942b036ca6.1920x1080.jpg",
      },
      {
        id: "cp2077-update",
        game: "Cyberpunk 2077",
        appId: "1091500",
        slug: "cyberpunk-2077",
        title: "Actualización 2.13: Compatibilidad con AMD FSR 3 e Intel XeSS 1.3",
        author: "CD PROJEKT RED",
        date: "12 de sep 2026",
        dateTs: Date.parse("2026-09-12") / 1000,
        url: "https://store.steampowered.com/news/app/1091500",
        snippet:
          "La última actualización optimiza el rendimiento en trazado de caminos (Path Tracing) e introduce FSR 3 con generación de fotogramas en PC.",
        body:
          "<p>La última actualización optimiza el rendimiento en trazado de caminos (Path Tracing) e introduce FSR 3 con generación de fotogramas en PC, además de Intel XeSS 1.3 para mejorar la nitidez en equipos de gama media.</p>",
        image:
          "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_31ad4c6df7c2cf88c5efb0e008daaeef42617a23.1920x1080.jpg",
      },
    ];

    const appIdsParam = req.query.appIds ? String(req.query.appIds).split(",").map((id) => id.trim()).filter(Boolean) : [];
    const namesParam = req.query.names ? String(req.query.names).split("|").map((name) => name.trim()) : [];
    const slugsParam = req.query.slugs ? String(req.query.slugs).split(",").map((id) => id.trim()).filter(Boolean) : [];

    const apps = appIdsParam.map((appId, index) => ({
      appId,
      name: namesParam[index] || `Steam ${appId}`,
    }));

    const steamNews = apps.length ? await loadSteamNewsForApps(apps, 2, 28) : [];

    const curatedOwned = curated.filter(
      (item) =>
        (item.appId && appIdsParam.includes(item.appId)) ||
        (item.slug && slugsParam.includes(item.slug)),
    );

    const seen = new Set(steamNews.map((item) => item.id));
    const merged = [
      ...steamNews,
      ...curatedOwned.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }),
    ].sort((a, b) => (b.dateTs || 0) - (a.dateTs || 0));

    if (merged.length === 0 && appIdsParam.length === 0) {
      res.json(curated);
      return;
    }

    res.json(merged);
  } catch (error) {
    console.error("news:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "No se pudieron obtener las noticias." });
  }
});

app.get("/api/products/:slug", async (req, res) => {
  try {
    const product = (await loadProduct(req.params.slug)) ?? (await loadGame(req.params.slug));
    if (!product) {
      res.status(404).json({ error: "Producto no encontrado." });
      return;
    }
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "No se pudo cargar el producto." });
    console.error(error);
  }
});

app.post("/api/pc-fit", async (req, res) => {
  try {
    const slug = String(req.body?.slug || "");
    if (!slug) {
      res.status(400).json({ error: "Falta el juego." });
      return;
    }
    const product = (await loadProduct(slug)) ?? (await loadGame(slug));
    if (!product) {
      res.status(404).json({ error: "Producto no encontrado." });
      return;
    }
    const table =
      "requirementsTable" in product ? product.requirementsTable : undefined;
    res.json(
      fitPc(table, {
        os: String(req.body?.os || ""),
        cpu: String(req.body?.cpu || ""),
        gpu: String(req.body?.gpu || ""),
        ramGb: Number(req.body?.ramGb) || null,
      }),
    );
  } catch (error) {
    res.status(500).json({ error: "No se pudo comprobar tu PC." });
    console.error(error);
  }
});

app.get(["/api/download/windows", "/api/download/installer"], async (req, res) => {
  if (req.query.target === "app") {
    const appZip = await windowsAppZipPath();
    if (appZip) {
      res.set({
        "Cache-Control": "no-store",
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="GameNow-Windows.zip"',
      });
      return res.sendFile(appZip);
    }
  }

  const file = (await windowsInstallerPath()) || (await windowsPackagePath());
  if (!file) {
    res.status(404).json({
      error: "El instalador de Windows no está listo. Empaqueta la app y vuelve a intentar.",
    });
    return;
  }
  const installer = file.endsWith(".exe");
  res.set({
    "Cache-Control": "no-store",
    "Content-Type": installer ? "application/octet-stream" : "application/zip",
    "Content-Disposition": installer
      ? 'attachment; filename="GameNow-Setup.exe"'
      : 'attachment; filename="GameNow-Windows.zip"',
  });
  res.sendFile(file);
});

app.get(["/api/download/app", "/api/download/payload"], async (_req, res) => {
  const file = await windowsAppZipPath();
  if (!file) {
    res.status(404).json({
      error: "El paquete de la aplicación GameNow no está disponible.",
    });
    return;
  }
  res.set({
    "Cache-Control": "no-store",
    "Content-Type": "application/zip",
    "Content-Disposition": 'attachment; filename="GameNow-Windows.zip"',
  });
  res.sendFile(file);
});

app.get("/api/media/video", async (req, res) => {
  const publicId = String(req.query.id || "");
  try {
    const file = await cachedVideoPath(publicId);
    res.set({
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": videoContentType(file),
    });
    res.sendFile(file);
  } catch (error) {
    res.status(404).json({ error: "Vídeo no disponible." });
    console.error(error);
  }
});

// ── REVIEWS ──────────────────────────────────────────────────────────────────

app.get("/api/reviews/:slug", async (req, res) => {
  try {
    const reviews = await getReviews(req.params.slug);
    res.set("Cache-Control", "no-store");
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron cargar las reseñas." });
    console.error(error);
  }
});

app.post("/api/reviews/:slug", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Inicia sesión para escribir una reseña." });
      return;
    }
    const payload = verifyJwt(header.slice(7).trim());
    if (!payload?.sub) {
      res.status(401).json({ error: "Sesión no válida." });
      return;
    }
    if (!(await connectDb())) {
      res.status(503).json({ error: "La base de datos no está disponible." });
      return;
    }

    const slug = req.params.slug;
    const owns = await userOwnsGame(payload.sub, slug);
    if (!owns) {
      res.status(403).json({ error: "Debes poseer el juego en tu biblioteca para reseñarlo." });
      return;
    }

    const { rating, text } = req.body ?? {};
    if (!text || !rating) {
      res.status(400).json({ error: "Faltan campos obligatorios: rating y text." });
      return;
    }

    const account = await User.findById(payload.sub).select("username").lean();
    const author = account?.username || payload.username || "Anónimo";
    const result = await addReview(slug, payload.sub, author, Number(rating), String(text));
    if (result.error === "duplicate") {
      res.status(409).json({ error: "Ya publicaste una reseña para este juego." });
      return;
    }
    if (result.error === "db" || !result.review) {
      res.status(503).json({ error: "No se pudo guardar la reseña." });
      return;
    }
    res.status(201).json(result.review);
  } catch (error) {
    res.status(500).json({ error: "No se pudo guardar la reseña." });
    console.error(error);
  }
});

app.patch("/api/reviews/:slug/:id/helpful", async (req, res) => {
  try {
    const ok = await markHelpful(req.params.slug, req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Reseña no encontrada." });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Error al marcar como útil." });
    console.error(error);
  }
});


app.listen(config.port, "0.0.0.0", () => {
  console.log(`GameNow API http://0.0.0.0:${config.port}`);
  connectDb()
    .then((connected) => {
      console.log(connected ? "MongoDB Atlas pool listo" : "Usando snapshot local hasta configurar MONGODB_URI");
    })
    .catch((err) => {
      console.warn("Aviso: MongoDB no disponible, usando snapshot local.", err?.message || err);
    });
});
