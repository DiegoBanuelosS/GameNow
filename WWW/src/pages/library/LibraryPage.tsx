import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { SiteNav } from "../Store/SiteNav";
import { useAuth } from "../../data/AuthContext";
import { useOurCovers } from "../../data/catalog";
import { StoreArt } from "../../data/StoreArt";
import { Cloud, Gamepad2, Newspaper, RefreshCw } from "lucide-react";
import { MagnifyingGlass, Star } from "../../components/Icons";
import { LibraryDetail } from "./LibraryDetail";
import "./LibraryPage.css";

gsap.registerPlugin(useGSAP);

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface LibraryGameItem {
  slug: string;
  steamAppId?: string;
  name: string;
  cover: string;
  coverSrcSet?: string;
  coverSizes?: string;
  coverFallback?: string;
  banner?: string;
  miniIcon: string;
  genre: "RPG" | "Acción" | "Aventura" | "Shooter" | "Estrategia" | "Indie";
  lastPlayed: string;
  lastPlayedTimestamp: number;
  playTimeHours: number;
  isInstalled: boolean;
  isFavorite: boolean;
  purchased?: boolean;
  desktopShortcut?: boolean;
  taskbarPin?: boolean;
  beta?: string;
  metacritic?: number | null;
  userRating?: number;
  userNote?: string;
}

interface GameNewsItem {
  id: string;
  game: string;
  appId: string;
  slug?: string;
  title: string;
  author: string;
  date: string;
  url: string;
  snippet: string;
  image: string;
}

type CategoryTab = "all" | "recent" | "favorites" | "installed";
type GenreFilter = "all" | "RPG" | "Acción" | "Aventura" | "Shooter" | "Estrategia" | "Indie";
type SortOption = "recent" | "name" | "hours" | "rating";

const SORTS: { id: SortOption; label: string }[] = [
  { id: "recent", label: "Reciente" },
  { id: "name", label: "Nombre" },
  { id: "hours", label: "Horas" },
  { id: "rating", label: "Valoración" },
];

function ourCover(
  covers: Map<string, string>,
  game: { steamAppId?: string; slug: string; name: string },
) {
  return (
    covers.get(game.steamAppId || "") ||
    covers.get(game.slug) ||
    covers.get(game.name) ||
    covers.get(game.name.toLowerCase()) ||
    ""
  );
}

function artFallbacks(game: LibraryGameItem, ours: string) {
  const capsule = game.steamAppId
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/capsule_616x353.jpg`
    : "";
  return [game.coverFallback, capsule, ours].filter((url): url is string => Boolean(url && url !== game.cover));
}

export function LibraryPage() {
  const { user, status, token, refreshSteam, updateLibraryGame } = useAuth();
  const ourCovers = useOurCovers();

  // Estados de navegación y filtros
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [activeGenre, setActiveGenre] = useState<GenreFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Noticias reales desde backend
  const [news, setNews] = useState<GameNewsItem[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [userGames, setUserGames] = useState<LibraryGameItem[]>([]);

  const steamProfile = user?.steamId
    ? {
        steamId: user.steamId,
        steamName: user.steamName || user.username,
        avatarUrl: user.steamAvatarUrl || "",
      }
    : null;

  useEffect(() => {
    setUserGames(user?.steamGames ?? []);
    if (!user?._id) return;
    try {
      localStorage.removeItem(`gamenow_user_library_${user._id}`);
      localStorage.removeItem(`gamenow_steam_profile_${user._id}`);
    } catch {
      /* el navegador puede bloquear el almacenamiento */
    }
  }, [user]);

  // Cargar noticias oficiales de Steam
  useEffect(() => {
    let alive = true;
    fetch("/api/news")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: GameNewsItem[]) => {
        if (alive && Array.isArray(data)) {
          setNews(data);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = carouselRef.current.clientWidth;
      carouselRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const updateGamesState = (newGames: LibraryGameItem[]) => {
    setUserGames(newGames);
  };

  const handleSyncSteam = async () => {
    setIsSyncing(true);
    setSyncError(null);
    const result = await refreshSteam();
    if (!result.ok) {
      setSyncError(result.error || "No se pudo actualizar Steam.");
    }
    setIsSyncing(false);
  };

  const toggleFavorite = (slug: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = userGames.map((g) =>
      g.slug === slug ? { ...g, isFavorite: !g.isFavorite } : g,
    );
    updateGamesState(updated);
  };

  const toggleInstalled = (slug: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = userGames.map((g) =>
      g.slug === slug ? { ...g, isInstalled: !g.isInstalled } : g,
    );
    updateGamesState(updated);
  };

  // 6. Noticias exclusivas de los juegos que el usuario tiene en su biblioteca
  const libraryNews = useMemo(() => {
    if (userGames.length === 0) return [];
    const ownedSlugs = new Set(userGames.map((g) => g.slug));
    const ownedAppIds = new Set(userGames.map((g) => g.steamAppId).filter(Boolean));

    return news.filter((item) => {
      return (
        (item.slug && ownedSlugs.has(item.slug)) ||
        (item.appId && ownedAppIds.has(item.appId)) ||
        userGames.some((ug) => ug.name.toLowerCase().includes(item.game.toLowerCase()))
      );
    });
  }, [news, userGames]);

  // Juegos filtrados por búsqueda y categoría
  const filteredGames = useMemo(() => {
    return userGames.filter((g) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!g.name.toLowerCase().includes(q)) return false;
      }
      if (activeTab === "favorites" && !g.isFavorite) return false;
      if (activeTab === "installed" && !g.isInstalled) return false;
      if (activeGenre !== "all" && g.genre !== activeGenre) return false;
      return true;
    });
  }, [userGames, searchQuery, activeTab, activeGenre]);

  // Ordenamiento funcional
  const sortedGames = useMemo(() => {
    const list = [...filteredGames];
    switch (sortBy) {
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "hours":
        return list.sort((a, b) => b.playTimeHours - a.playTimeHours);
      case "rating":
        return list.sort((a, b) => (b.metacritic ?? 0) - (a.metacritic ?? 0));
      case "recent":
      default:
        return list.sort((a, b) => b.lastPlayedTimestamp - a.lastPlayedTimestamp);
    }
  }, [filteredGames, sortBy]);

  // Lista de "Último jugado"
  const recentGames = useMemo(() => {
    return [...userGames]
      .filter((g) => g.lastPlayedTimestamp > 0 || g.isInstalled)
      .sort((a, b) => b.lastPlayedTimestamp - a.lastPlayedTimestamp)
      .slice(0, 4);
  }, [userGames]);

  // Contadores para el sidebar
  const counts = useMemo(() => {
    return {
      all: userGames.length,
      recent: userGames.filter((g) => g.lastPlayedTimestamp > 0).length,
      favorites: userGames.filter((g) => g.isFavorite).length,
      installed: userGames.filter((g) => g.isInstalled).length,
    };
  }, [userGames]);

  const showRecentSection = (activeTab === "all" || activeTab === "recent") && !searchQuery && activeGenre === "all" && recentGames.length > 0;
  const layoutRef = useRef<HTMLElement>(null);
  const skipFilterMotion = useRef(true);
  const lastSearch = useRef("");

  const { contextSafe } = useGSAP(() => {
    if (status !== "authenticated" || reduceMotion() || !layoutRef.current) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".library-sidebar-search, .library-steam-pill, .library-nav-item", {
      x: -18,
      autoAlpha: 0,
      duration: 0.45,
      stagger: 0.05,
      clearProps: "transform,opacity,visibility",
    });
    tl.from(".library-news-section, .library-filter-bar", {
      y: 18,
      autoAlpha: 0,
      duration: 0.48,
      stagger: 0.08,
      clearProps: "transform,opacity,visibility",
    }, 0.08);
    tl.from(".library-cover-card", {
      y: 24,
      autoAlpha: 0,
      duration: 0.5,
      stagger: { each: 0.028, amount: 0.55 },
      clearProps: "transform,opacity,visibility",
    }, 0.14);
    tl.from(".library-game-row", {
      x: -12,
      autoAlpha: 0,
      duration: 0.34,
      stagger: { each: 0.012, amount: 0.4 },
      clearProps: "transform,opacity,visibility",
    }, 0.1);
  }, { scope: layoutRef, dependencies: [status] });

  useGSAP(() => {
    if (status !== "authenticated" || reduceMotion() || !layoutRef.current) return;
    if (skipFilterMotion.current) {
      skipFilterMotion.current = false;
      return;
    }

    const root = layoutRef.current;
    const cards = gsap.utils.toArray<HTMLElement>(".library-cover-card", root);
    const rows = gsap.utils.toArray<HTMLElement>(".library-game-row", root);
    gsap.from(cards.slice(0, 16), {
      y: 18,
      autoAlpha: 0,
      duration: 0.4,
      stagger: { each: 0.03, amount: 0.36 },
      ease: "power2.out",
      clearProps: "transform",
    });
    if (cards.length > 16) {
      gsap.from(cards.slice(16), { autoAlpha: 0, duration: 0.28, ease: "power1.out" });
    }
    gsap.from(rows.slice(0, 14), {
      x: -10,
      autoAlpha: 0,
      duration: 0.3,
      stagger: { each: 0.02, amount: 0.24 },
      ease: "power2.out",
      clearProps: "transform,opacity,visibility",
    });
    if (rows.length > 14) {
      gsap.from(rows.slice(14), { autoAlpha: 0, duration: 0.22, ease: "power1.out" });
    }
    gsap.from(".library-empty-msg, .library-empty-connect-card, .library-section-header", {
      y: 10,
      autoAlpha: 0,
      duration: 0.32,
      stagger: 0.05,
      ease: "power2.out",
    });
  }, { scope: layoutRef, dependencies: [activeTab, activeGenre, sortBy, status], revertOnUpdate: true });

  useGSAP(() => {
    if (status !== "authenticated" || reduceMotion() || !layoutRef.current) return;
    const previous = lastSearch.current;
    lastSearch.current = searchQuery;
    if (previous === searchQuery) return;

    if (searchQuery) {
      gsap.from(".library-covers-grid, .library-game-list, .library-empty-msg", {
        autoAlpha: 0,
        y: 8,
        duration: 0.24,
        ease: "power2.out",
        clearProps: "opacity,visibility,transform",
      });
      return;
    }

    gsap.from(".library-news-section, .library-recent-grid", {
      autoAlpha: 0,
      y: -12,
      duration: 0.34,
      ease: "power2.out",
    });
  }, { scope: layoutRef, dependencies: [searchQuery, status], revertOnUpdate: true });

  const swapView = contextSafe((apply: () => void) => {
    const root = layoutRef.current;
    const leaving = root?.querySelectorAll(".library-cover-card, .library-game-row, .library-empty-msg");
    if (!root || reduceMotion() || !leaving?.length) {
      apply();
      return;
    }
    gsap.to(leaving, {
      autoAlpha: 0,
      y: 8,
      duration: 0.16,
      stagger: { each: 0.004, amount: 0.08 },
      ease: "power1.in",
      overwrite: "auto",
      onComplete: () => {
        gsap.set(leaving, { clearProps: "opacity,visibility,transform" });
        apply();
      },
    });
  });

  const selectGame = (slug: string) => setSelectedSlug(slug);
  const selectedGame = userGames.find((game) => game.slug === selectedSlug) ?? null;

  // 3. SI NO TIENE SESIÓN INICIADA, PEDIRLE QUE LA INICIE PARA ACCEDER A BIBLIOTECA
  if (status === "loading") {
    return (
      <div className="library-page">
        <SiteNav />
        <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: "60vh" }}>
          <div style={{ textAlign: "center", color: "var(--color-fg-muted)" }}>
            <img src="/logotipes/micrologotipe.svg" alt="" width="48" height="48" style={{ margin: "0 auto 16px" }} />
            <p style={{ letterSpacing: "0.5px", fontSize: "14px" }}>Verificando cuenta…</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return (
      <div className="library-page">
        <SiteNav />
        <main className="library-auth-gate">
          <div className="library-auth-card">
            <img
              src="/logotipes/micrologotipe.svg"
              alt="GameNow"
              width="64"
              height="64"
              className="library-auth-logo"
            />
            <h1 className="library-auth-title">Inicia sesión para acceder a tu biblioteca</h1>
            <p className="library-auth-desc">
              Tu biblioteca de juegos está protegida. Inicia sesión con tu cuenta de GameNow para sincronizar tus juegos de Steam, guardar tus favoritos y consultar tus horas jugadas.
            </p>
            <div className="library-auth-actions">
              <Link to="/auth#iniciar" className="library-auth-btn-primary">
                Iniciar sesión
              </Link>
              <Link to="/auth#crear" className="library-auth-btn-secondary">
                Crear una cuenta nueva
              </Link>
            </div>
            <div className="library-auth-features">
              <div className="library-auth-feature-item">
                <Gamepad2 className="library-auth-feature-icon" size={16} aria-hidden="true" />
                <span>Catálogo personal y partidas guardadas en la nube</span>
              </div>
              <div className="library-auth-feature-item">
                <Cloud className="library-auth-feature-icon" size={16} aria-hidden="true" />
                <span>Partidas guardadas y catálogo personalizado en la nube</span>
              </div>
              <div className="library-auth-feature-item">
                <Newspaper className="library-auth-feature-icon" size={16} aria-hidden="true" />
                <span>Novedades y notas de parche exclusivas de tus títulos</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="library-page">
      <SiteNav />

      <main className="library-layout" ref={layoutRef}>
        {/* =================================================================
            1. SIDEBAR IZQUIERDO: 100% PLANO, SIN FONDO, CON MINI ICONOS Y STEAM
            ================================================================= */}
        <aside className="library-sidebar" aria-label="Navegación de biblioteca">
          <div>
            <h2 className="library-sidebar-section-title">Biblioteca</h2>
            <div className="library-sidebar-search">
              <span className="library-sidebar-search-icon">
                <MagnifyingGlass size={15} />
              </span>
              <input
                type="search"
                className="library-sidebar-search-input"
                placeholder="Buscar juego..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* ESTADO O BOTÓN DE CONEXIÓN A STEAM EN EL SIDEBAR */}
          {steamProfile ? (
            <div className="library-steam-pill">
              <div className="library-steam-pill-user">
                {steamProfile.avatarUrl ? (
                  <img src={steamProfile.avatarUrl} alt="" className="library-steam-avatar" />
                ) : (
                  <Gamepad2 size={16} aria-hidden="true" />
                )}
                <span className="library-steam-name" title={steamProfile.steamName}>
                  {steamProfile.steamName}
                </span>
              </div>
              <div className="library-steam-pill-actions">
                <button
                  type="button"
                  className={`library-steam-mini-btn${isSyncing ? " is-syncing" : ""}`}
                  onClick={handleSyncSteam}
                  disabled={isSyncing}
                  title="Volver a sincronizar juegos con Steam"
                  aria-label="Volver a sincronizar juegos con Steam"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
          {syncError ? <p className="library-modal-error">{syncError}</p> : null}

          <nav className="library-nav-menu">
            <button
              type="button"
              className={`library-nav-item ${activeTab === "all" ? "active" : ""}`}
              onClick={() => swapView(() => setActiveTab("all"))}
            >
              <span>Todos mis juegos</span>
              <span className="library-nav-badge">{counts.all}</span>
            </button>

            <button
              type="button"
              className={`library-nav-item ${activeTab === "recent" ? "active" : ""}`}
              onClick={() => swapView(() => setActiveTab("recent"))}
            >
              <span>Último jugado</span>
              <span className="library-nav-badge">{counts.recent}</span>
            </button>

            <button
              type="button"
              className={`library-nav-item ${activeTab === "favorites" ? "active" : ""}`}
              onClick={() => swapView(() => setActiveTab("favorites"))}
            >
              <span>Favoritos</span>
              <span className="library-nav-badge">{counts.favorites}</span>
            </button>

            <button
              type="button"
              className={`library-nav-item ${activeTab === "installed" ? "active" : ""}`}
              onClick={() => swapView(() => setActiveTab("installed"))}
            >
              <span>Instalados</span>
              <span className="library-nav-badge">{counts.installed}</span>
            </button>
          </nav>

          <div className="library-sidebar-divider" />

          {/* LISTA RÁPIDA DE TÍTULOS CON MINI ICONOS */}
          <div className="library-titles">
            <h3 className="library-sidebar-section-title">Lista de títulos</h3>
            <div className="library-game-list">
              {sortedGames.map((game) => (
                <button
                  key={`row-${game.slug}`}
                  type="button"
                  className={`library-game-row${selectedSlug === game.slug ? " active" : ""}`}
                  onClick={() => selectGame(game.slug)}
                  title={game.name}
                >
                  <img
                    src={game.miniIcon}
                    alt=""
                    className="library-game-mini-icon"
                    loading="lazy"
                    onError={(event) => {
                      const image = event.currentTarget;
                      const next = ourCover(ourCovers, game) || game.coverFallback || game.cover;
                      if (next && image.src !== next) {
                        image.src = next;
                      }
                    }}
                  />
                  <span className="library-game-row-title">{game.name}</span>
                  {game.isInstalled && (
                    <span className="library-game-row-installed-icon" title="Instalado">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                  {game.isFavorite && (
                    <span className="library-game-row-fav" title="Favorito">
                      <Star size={12} weight="fill" />
                    </span>
                  )}
                </button>
              ))}
              {sortedGames.length === 0 && (
                <p style={{ color: "#777", fontSize: "12px", padding: "8px" }}>
                  {userGames.length === 0 ? "Sin juegos vinculados" : "Sin coincidencias"}
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* =================================================================
            2. LADO DERECHO: NOTICIAS, MENÚ DE FILTROS Y CARÁTULAS CORTADAS
            ================================================================= */}
        <section className="library-main" aria-label="Colección de juegos">
          {selectedGame ? (
            <LibraryDetail
              game={selectedGame}
              token={token}
              artFallbacks={artFallbacks(selectedGame, ourCover(ourCovers, selectedGame))}
              onClose={() => setSelectedSlug(null)}
              onRate={(userRating) => updateLibraryGame(selectedGame.slug, { userRating })}
              onNote={(userNote) => updateLibraryGame(selectedGame.slug, { userNote })}
              onDownload={() => updateLibraryGame(selectedGame.slug, { isInstalled: true })}
              onSettings={(patch) => updateLibraryGame(selectedGame.slug, patch)}
            />
          ) : (
          <>
          {/* NOTICIAS EN CARRUSEL HORIZONTAL (3 POR VP, SIN FONDO NI BADGE, SOLO DE SUS JUEGOS) */}
          {libraryNews.length > 0 && !searchQuery && (
            <section className="library-news-section" aria-label="Novedades de tus juegos">
              <div className="library-news-head">
                <h3>Novedades de tus juegos</h3>
                {libraryNews.length > 3 && (
                  <div className="library-news-nav">
                    <button
                      type="button"
                      className="library-news-arrow-btn"
                      onClick={() => scrollCarousel("left")}
                      aria-label="Ver noticias anteriores"
                      title="Anterior"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="library-news-arrow-btn"
                      onClick={() => scrollCarousel("right")}
                      aria-label="Ver siguientes noticias"
                      title="Siguiente"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="library-news-carousel" ref={carouselRef}>
                {libraryNews.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="library-news-card"
                    title={`Leer noticia: ${item.title}`}
                  >
                    <div className="library-news-img-wrap">
                      <img src={item.image} alt={item.game} className="library-news-img" loading="lazy" />
                      <span className="library-news-game-tag">{item.game}</span>
                    </div>
                    <div className="library-news-body">
                      <h4 className="library-news-title">{item.title}</h4>
                      <span className="library-news-meta">
                        {item.author} • {item.date}
                      </span>
                      <p className="library-news-snippet">{item.snippet}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* MENÚ DE FILTROS FUNCIONALES */}
          <div className="library-filter-bar">
            <div className="library-genre-pills">
              {(["all", "RPG", "Acción", "Aventura", "Shooter", "Estrategia", "Indie"] as GenreFilter[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`library-pill ${activeGenre === g ? "active" : ""}`}
                  onClick={() => swapView(() => setActiveGenre(g))}
                >
                  {g === "all" ? "Todos los géneros" : g}
                </button>
              ))}
            </div>

            <div className="library-sort-controls" role="group" aria-label="Ordenar juegos">
              {SORTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`library-pill ${sortBy === option.id ? "active" : ""}`}
                  onClick={() => swapView(() => setSortBy(option.id))}
                  aria-pressed={sortBy === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* SI LA BIBLIOTECA ESTÁ VACÍA: SIN ICONO NI REFERENCIA A STEAM */}
          {userGames.length === 0 && (
            <div className="library-empty-connect-card">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "#706a60" }}>
                <rect x="2" y="6" width="20" height="12" rx="3" />
                <circle cx="8" cy="12" r="1.5" />
                <path d="M14 10h4M14 14h4" />
              </svg>
              <h3>Tu biblioteca está vacía</h3>
              <p>
                Aún no tienes juegos en tu biblioteca. Explora el catálogo de la tienda para descubrir títulos y añadirlos a tu colección, o visita tu perfil de GameNow.
              </p>
              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <Link
                  to="/juegos"
                  className="library-auth-btn-primary"
                  style={{ textDecoration: "none", display: "inline-block" }}
                >
                  Explorar la tienda
                </Link>
                <Link
                  to="/profile"
                  className="library-auth-btn-secondary"
                  style={{ textDecoration: "none", display: "inline-block" }}
                >
                  Mi perfil
                </Link>
              </div>
            </div>
          )}

          {/* SECCIÓN: ÚLTIMO JUGADO (CARÁTULAS PANORÁMICAS RECORTADAS) */}
          {showRecentSection && (
            <div className="library-section">
              <div className="library-section-header">
                <h2 className="library-section-title">
                  Último jugado
                  <span className="library-count-pill">{recentGames.length}</span>
                </h2>
              </div>

              <div className="library-recent-grid">
                {recentGames.map((game) => (
                  <article
                    key={`recent-${game.slug}`}
                    className="library-cover-card library-recent-card"
                    tabIndex={0}
                    onClick={() => selectGame(game.slug)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectGame(game.slug);
                      }
                    }}
                  >
                    <StoreArt
                      src={game.cover}
                      fallback={game.coverFallback}
                      fallbacks={artFallbacks(game, ourCover(ourCovers, game))}
                      alt={`Carátula de ${game.name}`}
                      className="library-cover-img"
                    />

                    <div className="library-cover-overlay">
                      <div className="library-cover-top">
                        {game.isInstalled ? (
                          <span
                            className="library-cover-installed-icon"
                            onClick={(e) => toggleInstalled(game.slug, e)}
                            title="Instalado en este equipo (clic para alternar)"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        ) : (
                          <span />
                        )}
                        <div className="library-cover-actions">
                          {game.steamAppId && (
                            <a
                              href={`https://store.steampowered.com/app/${game.steamAppId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="library-cover-action-btn"
                              onClick={(e) => e.stopPropagation()}
                              title="Ver en tienda de Steam"
                              aria-label="Ver en tienda de Steam"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </a>
                          )}
                          <button
                            type="button"
                            className={`library-cover-action-btn ${game.isFavorite ? "active" : ""}`}
                            onClick={(e) => toggleFavorite(game.slug, e)}
                            title={game.isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                            aria-label="Favorito"
                          >
                            <Star size={15} weight={game.isFavorite ? "fill" : "regular"} />
                          </button>
                        </div>
                      </div>

                      <div className="library-cover-bottom">
                        <span className="library-cover-title">{game.name}</span>
                        <span className="library-cover-time">
                          {game.lastPlayed} • {game.playTimeHours} hrs jugadas
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN: TODOS MIS JUEGOS (CARÁTULAS EN ALTA RESOLUCIÓN RECORTADAS) */}
          {userGames.length > 0 && (
            <div className="library-section">
              <div className="library-section-header">
                <h2 className="library-section-title">
                  {activeTab === "all" && "Todos mis juegos"}
                  {activeTab === "recent" && "Historial reciente"}
                  {activeTab === "favorites" && "Mis favoritos"}
                  {activeTab === "installed" && "Juegos instalados"}
                  <span className="library-count-pill">{sortedGames.length}</span>
                </h2>
              </div>

              {sortedGames.length > 0 ? (
                <div className="library-covers-grid">
                  {sortedGames.map((game) => (
                    <article
                      key={game.slug}
                      className="library-cover-card"
                      tabIndex={0}
                      onClick={() => selectGame(game.slug)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectGame(game.slug);
                        }
                      }}
                    >
                      <StoreArt
                        src={game.cover}
                        fallback={game.coverFallback}
                        fallbacks={artFallbacks(game, ourCover(ourCovers, game))}
                        alt={`Carátula de ${game.name}`}
                        className="library-cover-img"
                      />

                      <div className="library-cover-overlay">
                        <div className="library-cover-top">
                          {game.isInstalled ? (
                            <span
                              className="library-cover-installed-icon"
                              onClick={(e) => toggleInstalled(game.slug, e)}
                              title="Instalado en este equipo (clic para alternar)"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          ) : (
                            <span />
                          )}
                          <div className="library-cover-actions">
                            {game.steamAppId && (
                              <a
                                href={`https://store.steampowered.com/app/${game.steamAppId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="library-cover-action-btn"
                                onClick={(e) => e.stopPropagation()}
                                title="Ver en tienda de Steam"
                                aria-label="Ver en tienda de Steam"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="16" x2="12" y2="12" />
                                  <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                              </a>
                            )}
                            <button
                              type="button"
                              className={`library-cover-action-btn ${game.isFavorite ? "active" : ""}`}
                              onClick={(e) => toggleFavorite(game.slug, e)}
                              title={game.isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                              aria-label="Favorito"
                            >
                              <Star size={15} weight={game.isFavorite ? "fill" : "regular"} />
                            </button>
                          </div>
                        </div>

                        <div className="library-cover-bottom">
                          <span className="library-cover-title">{game.name}</span>
                          <span className="library-cover-time">
                            {game.playTimeHours} hrs • {game.genre}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="library-empty-msg">
                  <p>No se encontraron juegos con los filtros seleccionados.</p>
                  {(activeTab !== "all" || activeGenre !== "all" || searchQuery) && (
                    <button
                      type="button"
                      className="library-pill active"
                      style={{ margin: "16px auto", display: "inline-block" }}
                      onClick={() => {
                        setActiveTab("all");
                        setActiveGenre("all");
                        setSearchQuery("");
                      }}
                    >
                      Restablecer filtros
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          </>
          )}
        </section>
      </main>
    </div>
  );
}
