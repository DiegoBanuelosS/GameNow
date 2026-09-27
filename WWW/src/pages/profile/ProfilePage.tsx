import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock3, Gamepad2, UserRound } from "lucide-react";
import { AuthRequiredGate } from "../../components/AuthRequiredGate";
import { SiteNav } from "../Store/SiteNav";
import { Footer9 } from "../Store/Footer9";
import { useAuth, type SteamLibraryGame } from "../../data/AuthContext";
import { useOurCovers } from "../../data/catalog";
import { StoreArt } from "../../data/StoreArt";
import { SteamLogo } from "../../components/SteamLogo";
import "./ProfilePage.css";

const LINK_ERRORS: Record<string, string> = {
  cancel: "Cancelaste el inicio de sesión en Steam.",
  taken: "Esa cuenta de Steam ya está vinculada a otro usuario de GameNow.",
  invalid: "Steam no confirmó el inicio de sesión. Inténtalo de nuevo.",
  steam: "No se pudo leer tu perfil público de Steam.",
};

export function ProfilePage() {
  const { user, status, connectSteam, unlinkSteam } = useAuth();
  const ourCovers = useOurCovers();
  const [params, setParams] = useSearchParams();
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const steamLinked = Boolean(user?.steamId);
  const games: SteamLibraryGame[] = user?.steamGames ?? [];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentGames = [...games]
    .filter((game) => game.lastPlayedTimestamp >= weekAgo)
    .sort((a, b) => b.lastPlayedTimestamp - a.lastPlayedTimestamp);
  const totalHours = Math.round(games.reduce((acc, game) => acc + (game.playTimeHours || 0), 0));
  const avatarUrl = steamLinked ? user?.steamAvatarUrl || user?.avatarUrl : user?.avatarUrl;
  const frameUrl = steamLinked ? user?.steamFrameUrl : "";
  const backgroundUrl = steamLinked ? user?.steamBackgroundUrl : "";
  const backgroundVideo = steamLinked ? user?.steamBackgroundVideo : "";

  useEffect(() => {
    if (params.get("steam") !== "error") return;
    const reason = params.get("reason") || "";
    setLinkError(LINK_ERRORS[reason] || "No se pudo vincular Steam.");
    const next = new URLSearchParams(params);
    next.delete("steam");
    next.delete("reason");
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    if (!user?._id) return;
    try {
      localStorage.removeItem(`gamenow_steam_${user._id}`);
      localStorage.removeItem(`gamenow_games_${user._id}`);
      localStorage.removeItem("gamenow_steam_profile");
      localStorage.removeItem("gamenow_user_library");
    } catch {
      /* el navegador puede bloquear el almacenamiento */
    }
  }, [user?._id]);

  const handleConnectSteam = async () => {
    setLinking(true);
    setLinkError(null);
    const result = await connectSteam();
    if (!result.ok) {
      setLinkError(result.error || "No se pudo abrir Steam.");
      setLinking(false);
    }
  };

  const handleDisconnectSteam = async () => {
    if (!window.confirm("¿Deseas desvincular tu cuenta de Steam?")) return;
    const result = await unlinkSteam();
    if (!result.ok) {
      setLinkError(result.error || "No se pudo desvincular Steam.");
    }
  };

  if (status === "loading") {
    return (
      <div className="profile-page">
        <SiteNav />
        <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--color-fg-muted)" }}>
          <p>Cargando perfil…</p>
        </div>
        <Footer9 />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return (
      <div className="profile-page">
        <SiteNav />
        <AuthRequiredGate
          title="Inicia sesión para ver tu perfil"
          description="Accede a tu cuenta de GameNow para consultar tus últimos juegos jugados, tus horas acumuladas y gestionar tu biblioteca."
          features={[
            {
              icon: <UserRound size={16} aria-hidden="true" />,
              label: "Tu perfil, avatar y vínculo con Steam",
            },
            {
              icon: <Clock3 size={16} aria-hidden="true" />,
              label: "Horas jugadas y actividad reciente",
            },
            {
              icon: <Gamepad2 size={16} aria-hidden="true" />,
              label: "Acceso rápido a tu biblioteca",
            },
          ]}
        />
        <Footer9 />
      </div>
    );
  }

  return (
    <div className="profile-page">
      <SiteNav />

      <main className="profile-main-container">
        <section
          className="profile-hero"
          style={
            backgroundUrl
              ? {
                  backgroundImage: `url("${backgroundUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {backgroundVideo ? (
            <video
              className="profile-hero-media"
              autoPlay
              muted
              loop
              playsInline
              poster={backgroundUrl || undefined}
              src={backgroundVideo}
            />
          ) : null}
          {backgroundUrl || backgroundVideo ? <div className="profile-hero-scrim" /> : null}

          <div className="profile-hero-content">
            <div className="profile-user-info">
              <div className={`profile-avatar-wrap${frameUrl ? " has-frame" : ""}`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="profile-avatar-img" />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
                {frameUrl ? <img src={frameUrl} alt="" className="profile-avatar-frame" /> : null}
              </div>

              <div className="profile-user-meta">
                <div className="profile-username-row">
                  <h1 className="profile-username">{user.username}</h1>
                </div>
                <p className="profile-email">{user.email}</p>
                {steamLinked ? (
                  <div className="profile-steam-row">
                    <SteamLogo size={16} fill="#66c0f4" />
                    <span className="profile-steam-label">Steam:</span>
                    <strong className="profile-steam-name">{user.steamName || "Steam"}</strong>
                    <button type="button" className="profile-steam-unlink" onClick={handleDisconnectSteam}>
                      Desvincular
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="profile-stats-row">
              <div className="profile-stat-item">
                <span className="profile-stat-num">{games.length}</span>
                <span className="profile-stat-label">Juegos</span>
              </div>
              <div className="profile-stat-item">
                <span className="profile-stat-num">{totalHours}h</span>
                <span className="profile-stat-label">Tiempo jugado</span>
              </div>
            </div>
          </div>
        </section>

        <div className="profile-body">
          {linkError ? <p className="profile-link-error">{linkError}</p> : null}

          {!steamLinked ? (
            <div className="profile-private-actions-bar">
              <div className="profile-private-actions-text">
                <h3 className="profile-private-actions-title">Conecta tu cuenta o compra juegos</h3>
                <p className="profile-private-actions-subtitle">
                  Al vincular tu cuenta de Steam se unirán en una sola: tu nombre de usuario principal será tu cuenta de GameNow, mostrando también tu cuenta de Steam, catálogo de juegos, avatar y logros unificados.
                </p>
              </div>
              <div className="profile-private-actions-btns">
                <button
                  type="button"
                  className="profile-steam-connect-btn"
                  onClick={handleConnectSteam}
                  disabled={linking}
                >
                  <SteamLogo size={18} fill="#fff" />
                  <span>{linking ? "Abriendo Steam…" : "Conectar con Steam"}</span>
                </button>
                <Link to="/juegos" className="profile-buy-games-btn">
                  Comprar juegos
                </Link>
              </div>
            </div>
          ) : null}

          <section aria-label="Juegos de esta semana">
            <div className="profile-section-header">
              <h2 className="profile-section-title">
                <span>Esta semana</span>
                {recentGames.length > 0 && (
                  <span className="profile-section-count">{recentGames.length}</span>
                )}
              </h2>
              {recentGames.length > 0 && (
                <Link
                  to="/library"
                  style={{
                    color: "var(--color-accent-primary)",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Ver todos en Biblioteca →
                </Link>
              )}
            </div>

            {steamLinked && (user.steamGameCount || 0) > games.length ? (
              <p className="profile-link-error">
                Steam tiene {user.steamGameCount} juegos y aquí solo llegaron {games.length}.
              </p>
            ) : null}

            {recentGames.length > 0 ? (
              <div className="profile-recent-grid">
                {recentGames.map((game) => (
                  <Link
                    key={game.steamAppId || game.slug}
                    to="/library"
                    className="profile-recent-card"
                    title={`Abrir ${game.name} en la biblioteca`}
                  >
                    <div className="profile-recent-cover-wrap">
                      <StoreArt
                        src={game.cover}
                        fallback={game.coverFallback}
                        fallbacks={[
                          game.steamAppId
                            ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/capsule_616x353.jpg`
                            : "",
                          ourCovers.get(game.steamAppId || "") ||
                            ourCovers.get(game.slug) ||
                            ourCovers.get(game.name) ||
                            "",
                        ].filter(Boolean)}
                        alt={game.name}
                        className="profile-recent-cover"
                      />
                      <span className="profile-recent-tag">{game.genre}</span>
                    </div>
                    <div className="profile-recent-info">
                      <h3 className="profile-recent-title">{game.name}</h3>
                      <div className="profile-recent-meta-row">
                        <span>Última vez: {game.lastPlayed}</span>
                        <span className="profile-recent-hours">{game.playTimeHours} hrs</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="profile-recent-empty">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "#706a60" }}>
                  <rect x="2" y="6" width="20" height="12" rx="3" />
                  <circle cx="8" cy="12" r="1.5" />
                  <path d="M14 10h4M14 14h4" />
                </svg>
                <p>
                  {steamLinked
                    ? "No hay partidas en los últimos 7 días."
                    : "Aún no tienes juegos en tu perfil ni actividad registrada."}
                </p>
                {!steamLinked ? (
                  <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                    <Link to="/juegos" className="profile-buy-games-btn">
                      Explorar la tienda
                    </Link>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer9 />
    </div>
  );
}
