import { useEffect, useState } from "react";
import { Gamepad2, MessageCircle, Star, UserMinus } from "lucide-react";
import { Link } from "react-router-dom";
import { SiteNav } from "../Store/SiteNav";
import { Footer9 } from "../Store/Footer9";
import { apiUrl } from "../../data/api";
import { useAuth } from "../../data/AuthContext";
import "./FriendsPage.css";

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

function playingCover(appId: string, step = 0) {
  if (!appId) return "";
  const file = step === 0 ? "header.jpg" : "capsule_231x87.jpg";
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/${file}`;
}

function formatPlay(minutes: number, span: Friend["playingSpan"]) {
  if (!minutes) return "";
  const amount = minutes < 60 ? `${minutes} min` : `${Math.round((minutes / 60) * 10) / 10} h`;
  if (span === "week") return `${amount} esta semana`;
  if (span === "total") return `${amount} en total`;
  return amount;
}

export function FriendsPage() {
  const { user, token, status } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [openInvite, setOpenInvite] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !token) {
      setLoading(false);
      return;
    }
    let alive = true;
    fetch(apiUrl("/api/steam/friends"), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "amigos");
        return data as { friends?: Friend[]; hidden?: boolean };
      })
      .then((data) => {
        if (!alive) return;
        setFriends(data.friends ?? []);
        setHidden(Boolean(data.hidden));
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [status, token, user?.steamId]);

  const patchFriend = async (steamId: string, body: Record<string, unknown>) => {
    if (!token) return null;
    const response = await fetch(apiUrl("/api/steam/friends"), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ steamId, ...body }),
    });
    const data = await response.json();
    if (!response.ok) return null;
    return data as Pick<Friend, "steamId" | "favorite" | "inviteGame" | "messages"> & { hidden?: boolean };
  };

  const applyPatch = (steamId: string, body: Record<string, unknown>) => {
    patchFriend(steamId, body).then((data) => {
      if (!data) return;
      setFriends((current) => {
        if (data.hidden) return current.filter((friend) => friend.steamId !== steamId);
        return current.map((friend) => (friend.steamId === steamId ? { ...friend, ...data } : friend));
      });
    });
  };

  return (
    <div className="friends-page">
      <SiteNav />
      <main className="friends-main">
        <h1>Mis Amigos</h1>
        {status === "loading" || (status === "authenticated" && loading) ? (
          <p className="friends-empty">Cargando amigos…</p>
        ) : null}
        {status === "unauthenticated" ? (
          <p className="friends-empty">
            <Link to="/auth#iniciar">Inicia sesión</Link> para ver a tus amigos.
          </p>
        ) : null}
        {status === "authenticated" && !loading && !user?.steamId ? (
          <p className="friends-empty">
            Vincula Steam en tu <Link to="/profile">perfil</Link> para traer tu lista de amigos.
          </p>
        ) : null}
        {!loading && user?.steamId && hidden ? (
          <p className="friends-empty">Tu lista de amigos de Steam es privada.</p>
        ) : null}
        {!loading && user?.steamId && !hidden && friends.length === 0 && status === "authenticated" ? (
          <p className="friends-empty">Todavía no hay amigos en esta cuenta.</p>
        ) : null}
        {friends.length > 0 ? (
          <ul className="friends-list">
            {friends.map((friend) => (
              <li key={friend.steamId}>
                <div className="friends-row">
                  <Link className="friends-person" to={`/perfil/${friend.steamId}`}>
                    {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" /> : <span />}
                    <span>
                      <strong>{friend.name}</strong>
                      <small>{friend.status}</small>
                    </span>
                  </Link>
                  <div className="friends-actions">
                    <button
                      type="button"
                      className="friends-chat"
                      aria-pressed={openChat === friend.steamId}
                      onClick={() => {
                        setOpenInvite(null);
                        setOpenChat((current) => (current === friend.steamId ? null : friend.steamId));
                        setDraft("");
                      }}
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                      <span>Chat</span>
                    </button>
                    <button
                      type="button"
                      className="friends-invite"
                      aria-pressed={openInvite === friend.steamId}
                      onClick={() => {
                        setOpenChat(null);
                        setOpenInvite((current) => (current === friend.steamId ? null : friend.steamId));
                      }}
                    >
                      <Gamepad2 size={16} aria-hidden="true" />
                      <span>Invitar a un juego</span>
                    </button>
                    <button
                      type="button"
                      className="friends-favorite"
                      aria-pressed={friend.favorite}
                      onClick={() => applyPatch(friend.steamId, { favorite: !friend.favorite })}
                    >
                      <Star size={16} aria-hidden="true" fill={friend.favorite ? "currentColor" : "none"} />
                      <span>Favorito</span>
                    </button>
                    <button type="button" className="friends-remove" onClick={() => applyPatch(friend.steamId, { hidden: true })}>
                      <UserMinus size={16} aria-hidden="true" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                  <div className="friends-now">
                    {friend.playingGame ? (
                      <>
                        <span>
                          <strong>{friend.playingGame}</strong>
                          {friend.playingMinutes ? <small>{formatPlay(friend.playingMinutes, friend.playingSpan)}</small> : null}
                        </span>
                        {friend.playingAppId ? (
                          <img
                            src={playingCover(friend.playingAppId)}
                            alt=""
                            onError={(event) => {
                              const image = event.currentTarget;
                              if (image.dataset.step !== "1") {
                                image.dataset.step = "1";
                                image.src = playingCover(friend.playingAppId, 1);
                                return;
                              }
                              image.hidden = true;
                            }}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                {openChat === friend.steamId ? (
                  <form
                    className="friends-panel"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const text = draft.trim();
                      if (!text) return;
                      setDraft("");
                      applyPatch(friend.steamId, { message: text });
                    }}
                  >
                    {friend.messages.map((message) => (
                      <p key={`${message.at}-${message.text}`}>{message.text}</p>
                    ))}
                    <label>
                      Mensaje
                      <input value={draft} maxLength={280} onChange={(event) => setDraft(event.target.value)} />
                    </label>
                    <button type="submit">Enviar</button>
                  </form>
                ) : null}
                {openInvite === friend.steamId ? (
                  <div className="friends-panel">
                    {friend.inviteGame ? <p>Invitación: {friend.inviteGame}</p> : null}
                    {(user?.steamGames ?? []).length === 0 ? (
                      <p>No tienes juegos para invitar.</p>
                    ) : (
                      <label>
                        Elige un juego
                        <select
                          defaultValue=""
                          onChange={(event) => {
                            if (!event.target.value) return;
                            applyPatch(friend.steamId, { inviteGame: event.target.value });
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
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </main>
      <Footer9 />
    </div>
  );
}
