import { useEffect, useState } from "react";
import { Star } from "../../components/Icons";
import { useDownloads } from "../../data/DownloadsContext";
import { useLaunch } from "../../data/LaunchContext";
import { apiUrl } from "../../data/api";
import { StoreArt } from "../../data/StoreArt";

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: number;
};

type LibraryDetailGame = {
  slug: string;
  steamAppId?: string;
  name: string;
  cover: string;
  coverFallback?: string;
  banner?: string;
  genre: string;
  playTimeHours: number;
  isInstalled: boolean;
  purchased?: boolean;
  desktopShortcut?: boolean;
  taskbarPin?: boolean;
  beta?: string;
  userRating?: number;
  userNote?: string;
};

type LibraryDetailProps = {
  game: LibraryDetailGame;
  token: string | null;
  artFallbacks: string[];
  onClose: () => void;
  onRate: (rating: number) => Promise<{ ok: boolean; error?: string }>;
  onNote: (note: string) => Promise<{ ok: boolean; error?: string }>;
  onDownload: () => Promise<{ ok: boolean; error?: string }>;
  onSettings: (patch: {
    desktopShortcut?: boolean;
    taskbarPin?: boolean;
    beta?: string;
    sell?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
};

export function LibraryDetail({
  game,
  token,
  artFallbacks,
  onClose,
  onRate,
  onNote,
  onDownload,
  onSettings,
}: LibraryDetailProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [achievementState, setAchievementState] = useState<"loading" | "ready" | "error">("loading");
  const [rating, setRating] = useState(game.userRating || 0);
  const [note, setNote] = useState(game.userNote || "");
  const [savingRating, setSavingRating] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [notice, setNotice] = useState("");
  const { jobFor } = useDownloads();
  const { startLaunch } = useLaunch();
  const job = jobFor(game.slug);
  const inFlight = job?.status === "active" || job?.status === "queued" || job?.status === "done";
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<"menu" | "properties" | "sell">("menu");
  const [shortcut, setShortcut] = useState(Boolean(game.desktopShortcut));
  const [pinned, setPinned] = useState(Boolean(game.taskbarPin));
  const [beta, setBeta] = useState(game.beta || "stable");

  useEffect(() => {
    setRating(game.userRating || 0);
    setNote(game.userNote || "");
    setShowAllAchievements(false);
    setNotice("");
    setMenuOpen(false);
    setMenuView("menu");
    setShortcut(Boolean(game.desktopShortcut));
    setPinned(Boolean(game.taskbarPin));
    setBeta(game.beta || "stable");
    if (!game.steamAppId || !token) {
      setAchievements([]);
      setAchievementState("ready");
      return;
    }
    let alive = true;
    setAchievementState("loading");
    fetch(apiUrl(`/api/steam/achievements/${game.steamAppId}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "logros");
        return data.achievements as Achievement[];
      })
      .then((list) => {
        if (!alive) return;
        setAchievements(Array.isArray(list) ? list : []);
        setAchievementState("ready");
      })
      .catch(() => {
        if (alive) setAchievementState("error");
      });
    return () => {
      alive = false;
    };
  }, [game.slug, game.steamAppId, game.userRating, game.userNote, token]);

  const unlocked = achievements.filter((item) => item.unlocked).length;
  const visibleAchievements = showAllAchievements ? achievements : achievements.slice(0, 8);

  const rate = async (value: number) => {
    setRating(value);
    setSavingRating(true);
    setNotice("");
    const result = await onRate(value);
    setSavingRating(false);
    if (!result.ok) {
      setRating(game.userRating || 0);
      setNotice(result.error || "No se pudo guardar la calificación.");
    }
  };

  const saveNote = async () => {
    setSavingNote(true);
    setNotice("");
    const result = await onNote(note.trim());
    setSavingNote(false);
    if (!result.ok) setNotice(result.error || "No se pudo guardar la nota.");
  };

  const steamBase = game.steamAppId
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}`
    : "";
  const bannerChain = [
    steamBase ? `${steamBase}/library_hero_2x.jpg` : "",
    steamBase ? `${steamBase}/library_hero.jpg` : "",
    game.banner || "",
    steamBase ? `${steamBase}/capsule_616x353.jpg` : "",
    game.coverFallback || "",
    game.cover || "",
  ].filter((url, index, list) => Boolean(url) && list.indexOf(url) === index);
  const [banner, setBanner] = useState(bannerChain[0] || "");

  useEffect(() => {
    setBanner(bannerChain[0] || "");
  }, [game.slug]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const download = async () => {
    setNotice("");
    const result = await onDownload();
    if (!result.ok) setNotice(result.error || "No se pudo descargar el juego.");
  };

  return (
    <article className="library-detail" aria-label={game.name}>
      <button type="button" className="library-detail-back" onClick={onClose}>
        Volver a la biblioteca
      </button>

      <div className="library-detail-hero">
        {banner ? (
          <img
            className="library-detail-banner"
            src={banner}
            alt=""
            onError={() => {
              const next = bannerChain[bannerChain.indexOf(banner) + 1] || "";
              setBanner(next);
            }}
          />
        ) : null}
        <div className="library-detail-scrim" />
        <StoreArt
          src={game.cover}
          fallback={game.coverFallback}
          fallbacks={artFallbacks}
          alt=""
          className="library-detail-cover"
        />
        <button
          type="button"
          className="library-detail-config"
          onClick={() => {
            setMenuView("menu");
            setMenuOpen(true);
          }}
        >
          Configurar
        </button>
        <div className="library-detail-copy">
          <p className="library-detail-genre">{game.genre}</p>
          <h2>{game.name}</h2>
          <p className="library-detail-hours">{game.playTimeHours} hrs jugadas</p>
          {game.isInstalled ? (
            <button
              type="button"
              className="library-detail-download"
              onClick={() =>
                startLaunch({
                  name: game.name,
                  image: bannerChain[0] || banner || game.cover || "",
                  images: bannerChain,
                  cover: game.cover || game.coverFallback || banner || "",
                })
              }
            >
              Jugar
            </button>
          ) : (
            <button type="button" className="library-detail-download" onClick={download} disabled={inFlight}>
              {job?.status === "queued" ? "En cola" : inFlight ? "Descargando…" : "Descargar"}
            </button>
          )}
        </div>
      </div>
      {menuOpen ? (
        <div className="library-config-backdrop" onClick={() => setMenuOpen(false)}>
          <div
            className="library-config-menu"
            role="dialog"
            aria-modal="true"
            aria-label={`Configurar ${game.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <StoreArt
              src={game.cover}
              fallback={game.coverFallback}
              fallbacks={artFallbacks}
              alt=""
              className="library-config-art"
            />
            {menuView === "menu" ? (
              <div className="library-config-options">
                <button
                  type="button"
                  disabled={!game.purchased}
                  onClick={() => {
                    if (!game.purchased) return;
                    setMenuView("sell");
                  }}
                >
                  Vender
                </button>
                {!game.purchased ? <p className="library-config-note">Solo puedes vender juegos de GameNow.</p> : null}
                <button type="button" onClick={() => setMenuView("properties")}>
                  Propiedades
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotice("Cuéntanos el problema desde tu perfil.");
                    setMenuOpen(false);
                  }}
                >
                  Tuve un problema con mi juego
                </button>
              </div>
            ) : null}
            {menuView === "sell" ? (
              <div className="library-config-panel">
                <p>Vender quita este juego de GameNow de tu biblioteca.</p>
                <button
                  type="button"
                  onClick={async () => {
                    const result = await onSettings({ sell: true });
                    if (!result.ok) {
                      setNotice(result.error || "No se pudo vender el juego.");
                      return;
                    }
                    setMenuOpen(false);
                    onClose();
                  }}
                >
                  Confirmar venta
                </button>
                <button type="button" onClick={() => setMenuView("menu")}>
                  Volver
                </button>
              </div>
            ) : null}
            {menuView === "properties" ? (
              <div className="library-config-panel">
                <h3>Propiedades</h3>
                <p className="library-config-label">Archivos del juego</p>
                {game.isInstalled ? (
                  <>
                    <p>{`GameNow\\juegos\\${game.slug}`}</p>
                    <ul className="library-config-files">
                      <li>{`${game.name}.exe`}</li>
                      <li>bin\engine.dll</li>
                      <li>data\assets.pack</li>
                      <li>data\audio.pack</li>
                    </ul>
                  </>
                ) : (
                  <p>Descarga el juego para ver sus archivos.</p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    const next = !shortcut;
                    setShortcut(next);
                    const result = await onSettings({ desktopShortcut: next });
                    if (!result.ok) setShortcut(!next);
                  }}
                >
                  {shortcut ? "Quitar acceso directo del escritorio" : "Añadir acceso directo al escritorio"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const next = !pinned;
                    setPinned(next);
                    const result = await onSettings({ taskbarPin: next });
                    if (!result.ok) setPinned(!next);
                  }}
                >
                  {pinned ? "Quitar de la barra de tareas" : "Anclar a la barra de tareas"}
                </button>
                <p>El acceso directo y el anclaje se aplican en la app de Windows.</p>
                <label className="library-config-label">
                  Versiones y betas
                  <select
                    value={beta}
                    onChange={async (event) => {
                      const next = event.target.value;
                      const previous = beta;
                      setBeta(next);
                      const result = await onSettings({ beta: next });
                      if (!result.ok) setBeta(previous);
                    }}
                  >
                    <option value="stable">Estable</option>
                    <option value="beta">Beta</option>
                    <option value="experimental">Experimental</option>
                    <option value="previous">Versión anterior</option>
                  </select>
                </label>
                <button type="button" onClick={() => setMenuView("menu")}>
                  Volver
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="library-detail-rate" aria-label="Calificación">
        <h3>¿Qué te pareció el juego?</h3>
        <div className="library-detail-stars" role="group" aria-label="Calificación de 1 a 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={value <= rating ? "is-on" : ""}
              aria-pressed={rating === value}
              aria-label={`${value} de 5`}
              disabled={savingRating}
              onClick={() => rate(value)}
            >
              <Star size={22} weight={value <= rating ? "fill" : "regular"} />
            </button>
          ))}
        </div>
        <label className="library-detail-note">
          Añadir nota
          <textarea
            value={note}
            maxLength={500}
            rows={3}
            placeholder="Escribe qué te pareció"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button type="button" className="library-detail-download" onClick={saveNote} disabled={savingNote}>
          {savingNote ? "Guardando…" : "Guardar nota"}
        </button>
      </section>

      {notice ? <p className="library-detail-notice">{notice}</p> : null}

      <section className="library-detail-achievements" aria-label="Logros">
        <div className="library-section-header">
          <h3>Logros</h3>
          {achievementState === "ready" && achievements.length > 0 ? (
            <span className="library-count-pill">
              {unlocked} de {achievements.length}
            </span>
          ) : null}
        </div>
        {achievementState === "loading" ? <p className="library-detail-muted">Cargando logros…</p> : null}
        {achievementState === "error" ? (
          <p className="library-detail-muted">No se pudieron cargar los logros de este juego.</p>
        ) : null}
        {achievementState === "ready" && achievements.length === 0 ? (
          <p className="library-detail-muted">Este juego no tiene logros públicos.</p>
        ) : null}
        {achievementState === "ready" && achievements.length > 0 ? (
          <ul className="library-achievement-list">
            {visibleAchievements.map((item) => (
              <li key={item.id} className={item.unlocked ? "is-unlocked" : ""}>
                {item.icon ? <img src={item.icon} alt="" /> : <span className="library-achievement-mark" />}
                <span>
                  <strong>{item.name}</strong>
                  {item.description ? <small>{item.description}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {achievements.length > 8 ? (
          <button type="button" className="library-detail-back" onClick={() => setShowAllAchievements((open) => !open)}>
            {showAllAchievements ? "Ver menos" : "Ver todos"}
          </button>
        ) : null}
      </section>
    </article>
  );
}
