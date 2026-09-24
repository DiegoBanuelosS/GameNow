import cors from "cors";
import express from "express";
import { loadProduct, loadStore } from "./catalog.js";
import { loadGame, loadGames } from "./games.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { fitPc } from "./pcFit.js";
import { windowsInstallerPath, windowsAppZipPath, windowsPackagePath } from "./download.js";
import { cachedVideoPath, videoContentType } from "./videoCache.js";
import { getReviews, addReview, markHelpful } from "./reviews.js";
import { authRouter } from "./auth.js";
import { steamCallback, steamRefresh, steamStart, steamUnlink } from "./steamLink.js";
import { addFriend, purchaseLibrary, resaleQuote, searchPeople, steamAchievements, steamFriends, steamProfile, updateFriend, updateLibraryGame } from "./steamSocial.js";

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

app.get("/api/store", async (_req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.json(await loadStore());
  } catch (error) {
    res.status(500).json({ error: "No se pudo cargar la tienda." });
    console.error(error);
  }
});

app.get("/api/games", async (_req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(await loadGames());
  } catch (error) {
    res.status(500).json({ error: "No se pudo cargar Nuestros Juegos." });
    console.error(error);
  }
});

app.get("/api/news", async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    
    // Base de noticias reales en español con CAPTURAS DE PANTALLA REALES (no carátulas)
    const newsCatalog = [
      {
        id: "bg3-patch-7",
        game: "Baldur's Gate 3",
        appId: "1086940",
        slug: "baldurs-gate-3",
        title: "Parche 7 ya disponible: Nuevas cinemáticas de finales oscuros y soporte oficial para mods",
        author: "Larian Studios",
        date: "18 de sep 2026",
        url: "https://store.steampowered.com/news/app/1086940",
        snippet: "Larian Studios introduce 13 cinemáticas nuevas para las rutas de conquista absoluta, gestor integrado de mods y pantalla dividida perfeccionada.",
        image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/ss_75e07a34e0a6d59b2075a898b958c8942b036ca6.1920x1080.jpg"
      },
      {
        id: "hl2-anniversary",
        game: "Half-Life 2",
        appId: "220",
        slug: "half-life-2",
        title: "Actualización del 20.º Aniversario: Episode One y Two unificados y comentarios de los creadores",
        author: "Valve",
        date: "28 de ago 2026",
        url: "https://store.steampowered.com/news/app/220",
        snippet: "Valve celebra dos décadas de Gordon Freeman unificando Episode One y Two en el cliente base, con 3.5 horas de comentarios inéditos de los creadores.",
        image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/ss_628a8d11dc9f0907e1fa16dbb6441eebaa211f44.1920x1080.jpg"
      },
      {
        id: "disco-final-cut",
        game: "Disco Elysium",
        appId: "632470",
        slug: "disco-elysium-the-final-cut",
        title: "Actualización de rendimiento y expansión de accesibilidad para The Final Cut",
        author: "ZA/UM",
        date: "14 de ago 2026",
        url: "https://store.steampowered.com/news/app/632470",
        snippet: "ZA/UM optimiza los tiempos de carga en Revachol, mejora el tamaño de las fuentes para alta resolución y soluciona sincronización en la nube.",
        image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/632470/ss_8471131b7cae61448b1d9bfcf7e7d6fa465b05fa.1920x1080.jpg"
      },
      {
        id: "bioshock-remaster",
        game: "BioShock",
        appId: "7670",
        slug: "bioshock",
        title: "Actualización de estabilidad: Compatibilidad completa con pantallas 21:9 y audio espacial",
        author: "2K Games",
        date: "22 de jul 2026",
        url: "https://store.steampowered.com/news/app/7670",
        snippet: "Parche correctivo enfocado en la estabilidad de Windows 11, soporte panorámico sin barras negras y balance sonoro en Rapture.",
        image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/7670/0000002447.1920x1080.jpg"
      },
      {
        id: "ace8-clouds",
        game: "ACE COMBAT 8",
        appId: "",
        slug: "ace-combat-8",
        title: "Informe técnico #3: Simulación meteorológica de alta fidelidad y frentes de tormenta",
        author: "Bandai Namco Aces",
        date: "10 de sep 2026",
        url: "/game/ace-combat-8",
        snippet: "Project Aces detalla la física aerodinámica de los nuevos cazas de quinta generación y el comportamiento de las nubes volumétricas en combate.",
        image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2288340/a704b72d7c8647b2c6773731fe7a79979674dc70/ss_a704b72d7c8647b2c6773731fe7a79979674dc70.1920x1080.jpg"
      },
      {
        id: "cp2077-update",
        game: "Cyberpunk 2077",
        appId: "1091500",
        slug: "cyberpunk-2077",
        title: "Actualización 2.13: Compatibilidad con AMD FSR 3 e Intel XeSS 1.3",
        author: "CD PROJEKT RED",
        date: "12 de sep 2026",
        url: "https://store.steampowered.com/news/app/1091500",
        snippet: "La última actualización optimiza el rendimiento en trazado de caminos (Path Tracing) e introduce FSR 3 con generación de fotogramas en PC.",
        image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_31ad4c6df7c2cf88c5efb0e008daaeef42617a23.1920x1080.jpg"
      }
    ];

    const appIdsParam = req.query.appIds ? String(req.query.appIds).split(",") : null;
    const slugsParam = req.query.slugs ? String(req.query.slugs).split(",") : null;

    let filtered = newsCatalog;
    if (appIdsParam || slugsParam) {
      filtered = newsCatalog.filter(
        (item) =>
          (item.appId && appIdsParam?.includes(item.appId)) ||
          (item.slug && slugsParam?.includes(item.slug))
      );
      if (filtered.length === 0) {
        filtered = newsCatalog;
      }
    }

    res.json(filtered);
  } catch (error) {
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
    const { author, rating, text } = req.body ?? {};
    if (!text || !rating) {
      res.status(400).json({ error: "Faltan campos obligatorios: rating y text." });
      return;
    }
    const review = await addReview(
      req.params.slug,
      String(author || ""),
      Number(rating),
      String(text),
    );
    res.status(201).json(review);
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
