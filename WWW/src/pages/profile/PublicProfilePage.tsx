import { useEffect, useState } from "react";
import { Gamepad2, MessageCircle, Star, UserMinus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SiteNav } from "../Store/SiteNav";
import { Footer9 } from "../Store/Footer9";
import { useAuth } from "../../data/AuthContext";
import { useOurCovers } from "../../data/catalog";
import { StoreArt } from "../../data/StoreArt";
import { SteamLogo } from "../../components/SteamLogo";
import "./ProfilePage.css";

type PublicGame = {
  slug: string;
  steamAppId: string;
  name: string;
  cover: string;
  coverFallback: string;
  genre: string;
  lastPlayed: string;
  lastPlayedTimestamp: number;
  playTimeHours: number;
};

type FriendRelation = {
  favorite: boolean;
  inviteGame: string;
  messages: { text: string; at: number }[];
};

type PublicProfile = {
  kind: "gamenow" | "steam";
  steamId: string;
  name: string;
  steamName: string;
  avatarUrl: string;
  frameUrl: string;
  backgroundUrl: string;
  backgroundVideo: string;
  gameCount: number;
  totalHours: number;
  games: PublicGame[];
  relation: FriendRelation | null;
};

export function PublicProfilePage() {
  const { steamId = "" } = useParams();
  const navigate = useNavigate();
  const { token, status, user } = useAuth();
  const [openChat, setOpenChat] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [draft, setDraft] = useState("");
  const ourCovers = useOurCovers();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated" || !token || !/^\d{17}$/.test(steamId)) {
      setLoading(false);
      setProfile(null);
      setError(status === "authenticated" ? "Perfil no válido." : "");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    fetch(`/api/steam/profile/${steamId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo abrir el perfil.");
        return data as PublicProfile;
      })
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((reason: Error) => {
        if (active) {
          setProfile(null);
          setError(reason.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [steamId, status, token]);

  const patchFriend = async (body: Record<string, unknown>) => {
    if (!token) return;
    const response = await fetch("/api/steam/friends", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ steamId, ...body }),
    });
    const data = await response.json();
    if (!response.ok) return;
    if (data.hidden) {
      navigate("/amigos");
      return;
    }
    setProfile((current) =>
      current
        ? {
            ...current,
            relation: {
              favorite: Boolean(data.favorite),
              inviteGame: data.inviteGame || "",
              messages: data.messages || [],
            },
          }
        : current,
    );
  };

  const frameUrl = profile?.frameUrl || "";
  const backgroundUrl = profile?.backgroundUrl || "";
  const backgroundVideo = profile?.backgroundVideo || "";

  return (
    <div className="profile-page">
      <SiteNav />
      <main className="profile-main-container">
        {status === "unauthenticated" ? (
          <div style={{ padding: "80px 24px", textAlign: "center" }}>
            <p className="profile-email">
              <Link to="/auth#iniciar">Inicia sesión</Link> para ver este perfil.
            </p>
          </div>
        ) : null}
        {loading ? <p className="profile-email" style={{ padding: "48px 24px" }}>Cargando perfil…</p> : null}
        {!loading && error ? <p className="profile-link-error" style={{ margin: "24px" }}>{error}</p> : null}
        {profile ? (
          <>
            <section
              className="profile-hero"
              style={
                backgroundUrl
                  ? { backgroundImage: `url("${backgroundUrl}")`, backgroundSize: "cover", backgroundPosition: "center" }
                  : undefined
              }
            >
              {backgroundVideo ? (
                <video className="profile-hero-media" autoPlay muted loop playsInline poster={backgroundUrl || undefined} src={backgroundVideo} />
              ) : null}
              {backgroundUrl || backgroundVideo ? <div className="profile-hero-scrim" /> : null}
              <div className="profile-hero-content">
                <div className="profile-user-info">
                  <div className={`profile-avatar-wrap${frameUrl ? " has-frame" : ""}`}>
                    {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="profile-avatar-img" /> : profile.name.charAt(0).toUpperCase()}
                    {frameUrl ? <img src={frameUrl} alt="" className="profile-avatar-frame" /> : null}
                  </div>
                  <div className="profile-user-meta">
                    {profile.kind === "steam" ? (
                      <h1 className="profile-username profile-username-steam">
                        <SteamLogo size={26} fill="#c7c1b8" />
                        <span>{profile.steamName}</span>
                      </h1>
                    ) : (
                      <>
                        <h1 className="profile-username">{profile.name}</h1>
                        {profile.steamName ? (
                          <div className="profile-steam-row">
                            <SteamLogo size={16} fill="#c7c1b8" />
                            <span className="profile-steam-name">{profile.steamName}</span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <div className="profile-stats-row">
                  <div className="profile-stat-item">
                    <span className="profile-stat-num">{profile.gameCount}</span>
                    <span className="profile-stat-label">Juegos</span>
                  </div>
                  {profile.kind === "gamenow" ? (
                    <div className="profile-stat-item">
                      <span className="profile-stat-num">{profile.totalHours}h</span>
                      <span className="profile-stat-label">Tiempo jugado</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
            <div className="profile-body">
              <section aria-label={profile.kind === "steam" ? "Juegos recientes" : "Juegos de esta semana"}>
                <div className="profile-section-header">
                  <h2 className="profile-section-title">
                    <span>{profile.kind === "steam" ? "Recientes" : "Esta semana"}</span>
                    {profile.games.length > 0 ? <span className="profile-section-count">{profile.games.length}</span> : null}
                  </h2>
                  <Link to="/amigos" style={{ color: "var(--color-accent-primary)", fontSize: "13.5px", fontWeight: 600, textDecoration: "none" }}>
                    Volver a amigos
                  </Link>
                </div>
                {profile.games.length > 0 ? (
                  <div className="profile-recent-grid">
                    {profile.games.map((game) => (
                      <div key={game.steamAppId || game.slug} className="profile-recent-card">
                        <div className="profile-recent-cover-wrap">
                          <StoreArt
                            src={game.cover}
                            fallback={game.coverFallback}
                            fallbacks={[
                              game.steamAppId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg` : "",
                              ourCovers.get(game.steamAppId || "") || ourCovers.get(game.slug) || ourCovers.get(game.name) || "",
                            ].filter(Boolean)}
                            alt={game.name}
                            className="profile-recent-cover"
                          />
                          {game.genre ? <span className="profile-recent-tag">{game.genre}</span> : null}
                        </div>
                        <div className="profile-recent-info">
                          <h3 className="profile-recent-title">{game.name}</h3>
                          <div className="profile-recent-meta-row">
                            <span>{game.lastPlayed ? `Última vez: ${game.lastPlayed}` : "Steam"}</span>
                            {game.playTimeHours ? <span className="profile-recent-hours">{game.playTimeHours} hrs</span> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="profile-recent-empty">
                    <p>{profile.kind === "steam" ? "Este perfil de Steam no muestra juegos recientes." : "No hay partidas en los últimos 7 días."}</p>
                  </div>
                )}
              </section>
              {profile.relation ? (
                <section className="profile-friend-actions" aria-label="Opciones">
                  <div className="profile-friend-buttons">
                    <button
                      type="button"
                      className="friends-chat"
                      aria-pressed={openChat}
                      onClick={() => {
                        setOpenInvite(false);
                        setOpenChat((open) => !open);
                        setDraft("");
                      }}
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                      <span>Chat</span>
                    </button>
                    <button
                      type="button"
                      className="friends-invite"
                      aria-pressed={openInvite}
                      onClick={() => {
                        setOpenChat(false);
                        setOpenInvite((open) => !open);
                      }}
                    >
                      <Gamepad2 size={16} aria-hidden="true" />
                      <span>Invitar a un juego</span>
                    </button>
                    <button
                      type="button"
                      className="friends-favorite"
                      aria-pressed={profile.relation.favorite}
                      onClick={() => patchFriend({ favorite: !profile.relation?.favorite })}
                    >
                      <Star size={16} aria-hidden="true" fill={profile.relation.favorite ? "currentColor" : "none"} />
                      <span>Favorito</span>
                    </button>
                    <button type="button" className="friends-remove" onClick={() => patchFriend({ hidden: true })}>
                      <UserMinus size={16} aria-hidden="true" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                  {openChat ? (
                    <form
                      className="profile-friend-panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const text = draft.trim();
                        if (!text) return;
                        setDraft("");
                        patchFriend({ message: text });
                      }}
                    >
                      {profile.relation.messages.map((message) => (
                        <p key={`${message.at}-${message.text}`}>{message.text}</p>
                      ))}
                      <label>
                        Mensaje
                        <input value={draft} maxLength={280} onChange={(event) => setDraft(event.target.value)} />
                      </label>
                      <button type="submit">Enviar</button>
                    </form>
                  ) : null}
                  {openInvite ? (
                    <div className="profile-friend-panel">
                      {profile.relation.inviteGame ? <p>Invitación: {profile.relation.inviteGame}</p> : null}
                      <label>
                        Elige un juego
                        <select
                          defaultValue=""
                          onChange={(event) => {
                            if (!event.target.value) return;
                            patchFriend({ inviteGame: event.target.value });
                          }}
                        >
                          <option value="">Selecciona</option>
                          {(user?.steamGames ?? []).map((game) => (
                            <option key={game.slug} value={game.name}>
                              {game.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </main>
      <Footer9 />
    </div>
  );
}
