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

const app = express();
app.use(
  cors({
    origin(origin, next) {
      if (!origin) {
        next(null, true);
        return;
      }
      if (
        origin === config.wwwOrigin ||
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

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


app.listen(config.port, "127.0.0.1", () => {
  console.log(`GameNow API http://127.0.0.1:${config.port}`);
  connectDb()
    .then((connected) => {
      console.log(connected ? "MongoDB Atlas pool listo" : "Usando snapshot local hasta configurar MONGODB_URI");
    })
    .catch((err) => {
      console.warn("Aviso: MongoDB no disponible, usando snapshot local.", err?.message || err);
    });
});
