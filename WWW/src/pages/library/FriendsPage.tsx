import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Gamepad2, MessageCircle, Search, Star, UserMinus, UserPlus, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthRequiredGate } from "../../components/AuthRequiredGate";
import { SiteNav } from "../Store/SiteNav";
import { Footer9 } from "../Store/Footer9";
import { PageLoader } from "../Store/LogoLoader";
import { apiUrl } from "../../data/api";
import { useAuth } from "../../data/AuthContext";
import { ChatModal } from "./ChatModal";
import "./FriendsPage.css";

type Person = {
  steamId: string;
  name: string;
  avatarUrl: string;
  username: string;
  alreadyFriend: boolean;
  source?: "gamenow" | "steam";
  miniBackgroundUrl?: string;
  miniBackgroundVideo?: string;
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

type FriendRequest = {
  fromUserId: string;
  steamId: string;
  name: string;
  avatarUrl: string;
  username: string;
  at: number;
};

function profilePath(steamId: string) {
  if (/^\d{17}$/.test(steamId) || steamId.startsWith("user:")) {
    return `/perfil/${encodeURIComponent(steamId)}`;
  }
  return "";
}

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
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openChat, setOpenChat] = useState(false);
  const [chatFocus, setChatFocus] = useState<string | null>(null);
  const [openInvite, setOpenInvite] = useState<string | null>(null);
  const [friendQuery, setFriendQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const addInput = useRef<HTMLInputElement>(null);
  const [searching, setSearching] = useState(false);
  const [addNotice, setAddNotice] = useState("");
  const [leavingRequestKeys, setLeavingRequestKeys] = useState<string[]>([]);
  const [enteringFriendIds, setEnteringFriendIds] = useState<string[]>([]);

  useEffect(() => {
    if (status !== "authenticated" || !token) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(apiUrl("/api/steam/friends"), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "amigos");
        return data as { friends?: Friend[]; requests?: FriendRequest[]; hidden?: boolean };
      })
      .then((data) => {
        if (!alive) return;
        setFriends(data.friends ?? []);
        setRequests(data.requests ?? []);
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
    return data as Record<string, unknown>;
  };

  const visibleFriends = friends.filter((friend) => {
    const query = friendQuery.trim().toLowerCase();
    if (!query) return true;
    return friend.name.toLowerCase().includes(query);
  });

  useEffect(() => {
    if (!adding) return;
    const frame = window.requestAnimationFrame(() => addInput.current?.focus());
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAdding(false);
        setAddQuery("");
        setPeople([]);
        setAddNotice("");
        setSearching(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [adding]);

  const closeAdd = () => {
    setAdding(false);
    setAddQuery("");
    setPeople([]);
    setAddNotice("");
    setSearching(false);
  };

  const searchPeople = async () => {
    const query = addQuery.trim();
    if (!token || query.length < 2) {
      setPeople([]);
      setAddNotice("Escribe al menos 2 caracteres.");
      return;
    }
    setSearching(true);
    setAddNotice("");
    try {
      const response = await fetch(apiUrl(`/api/steam/people?q=${encodeURIComponent(query)}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setAddNotice(data.error || "No se pudo buscar.");
        setPeople([]);
        return;
      }
      const found = (data.people ?? []) as Person[];
      setPeople(found);
      setAddNotice(found.length ? "" : "No encontramos a nadie con ese usuario o nombre.");
    } catch {
      setAddNotice("No se pudo buscar. Revisa tu conexión.");
    } finally {
      setSearching(false);
    }
  };

  const addPerson = async (person: Person) => {
    if (!token || person.alreadyFriend) return;
    setAddNotice("");
    const response = await fetch(apiUrl("/api/steam/friends"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ steamId: person.steamId, username: person.username }),
    });
    const data = await response.json();
    if (!response.ok) {
      setAddNotice(data.error || "No se pudo enviar la solicitud.");
      return;
    }
    setPeople((current) =>
      current.map((item) => (item.steamId === person.steamId ? { ...item, alreadyFriend: true } : item)),
    );
    if (data.status === "accepted") {
      setFriends((current) => {
        if (current.some((friend) => friend.steamId === person.steamId)) return current;
        return [
          {
            steamId: person.steamId,
            name: person.name,
            avatarUrl: person.avatarUrl,
            profileUrl: /^\d{17}$/.test(person.steamId) ? `https://steamcommunity.com/profiles/${person.steamId}` : "",
            status: person.username ? "En GameNow" : "Desconectado",
            playingGame: "",
            playingAppId: "",
            playingMinutes: 0,
            playingSpan: "",
            favorite: false,
            inviteGame: "",
            messages: [],
            backgroundUrl: person.miniBackgroundUrl,
          },
          ...current,
        ];
      });
      setRequests((current) => current.filter((item) => item.steamId !== person.steamId));
      setAddNotice(`${person.name} ahora es tu amigo.`);
      return;
    }
    setAddNotice(`Solicitud enviada a ${person.name}.`);
  };

  const respondRequest = async (request: FriendRequest, action: "accept" | "reject") => {
    const requestKey = `${request.fromUserId}-${request.steamId}`;
    const data = await patchFriend(request.steamId, { action });
    if (!data) return;

    if (action === "reject") {
      setLeavingRequestKeys((current) => [...current, requestKey]);
      window.setTimeout(() => {
        setRequests((current) =>
          current.filter((item) => item.steamId !== request.steamId && item.fromUserId !== request.fromUserId),
        );
        setLeavingRequestKeys((current) => current.filter((key) => key !== requestKey));
      }, 320);
      return;
    }

    const steamId = String(data.steamId || request.steamId);
    const nextFriend: Friend = {
      steamId,
      name: String(data.name || request.name),
      avatarUrl: String(data.avatarUrl || request.avatarUrl),
      profileUrl: /^\d{17}$/.test(steamId) ? `https://steamcommunity.com/profiles/${steamId}` : "",
      status: "En GameNow",
      playingGame: "",
      playingAppId: "",
      playingMinutes: 0,
      playingSpan: "",
      favorite: false,
      inviteGame: "",
      messages: [],
    };

    setLeavingRequestKeys((current) => [...current, requestKey]);
    window.setTimeout(() => {
      setRequests((current) =>
        current.filter((item) => item.steamId !== request.steamId && item.fromUserId !== request.fromUserId),
      );
      setLeavingRequestKeys((current) => current.filter((key) => key !== requestKey));
      setFriends((current) => {
        if (current.some((friend) => friend.steamId === steamId)) return current;
        return [nextFriend, ...current];
      });
      setEnteringFriendIds((current) => [...current, steamId]);
      window.setTimeout(() => {
        setEnteringFriendIds((current) => current.filter((id) => id !== steamId));
      }, 520);
    }, 280);
  };

  const applyPatch = (steamId: string, body: Record<string, unknown>) => {
    patchFriend(steamId, body).then((data) => {
      if (!data) return;
      setFriends((current) => {
        if (data.hidden) return current.filter((friend) => friend.steamId !== steamId);
        return current.map((friend) =>
          friend.steamId === steamId
            ? {
                ...friend,
                favorite: typeof data.favorite === "boolean" ? data.favorite : friend.favorite,
                inviteGame: typeof data.inviteGame === "string" ? data.inviteGame : friend.inviteGame,
              }
            : friend,
        );
      });
    });
  };

  const showLoader = status === "loading" || (status === "authenticated" && loading);

  if (status === "unauthenticated") {
    return (
      <div className="friends-page">
        <SiteNav />
        <AuthRequiredGate
          title="Inicia sesión para ver a tus amigos"
          description="Conecta tu cuenta de GameNow para ver tu lista de amigos, mandar solicitudes y chatear en privado."
          features={[
            {
              icon: <Users size={16} aria-hidden="true" />,
              label: "Lista de amigos de GameNow y Steam",
            },
            {
              icon: <MessageCircle size={16} aria-hidden="true" />,
              label: "Chat cifrado entre cuentas",
            },
            {
              icon: <UserPlus size={16} aria-hidden="true" />,
              label: "Busca y agrega gente por usuario o Steam",
            },
          ]}
        />
        <Footer9 />
      </div>
    );
  }

  return (
    <div className="friends-page">
      <SiteNav />
      <main className="friends-main">
        <h1>Mis Amigos</h1>
        {status === "authenticated" ? (
          <div className="friends-tools">
            <form
              className="friends-tool"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <label htmlFor="friend-search">Buscar amigos</label>
              <div className="friends-tool-row">
                <Search size={16} aria-hidden="true" />
                <input
                  id="friend-search"
                  value={friendQuery}
                  placeholder="Nombre"
                  onChange={(event) => setFriendQuery(event.target.value)}
                />
              </div>
            </form>
            {!adding ? (
              <button type="button" className="friends-add" onClick={() => setAdding(true)}>
                <UserPlus size={14} aria-hidden="true" />
                Agregar
              </button>
            ) : null}
          </div>
        ) : null}

        {adding ? (
          <div className="friends-add-overlay" role="dialog" aria-modal="true" aria-labelledby="friend-add-title">
            <button type="button" className="friends-add-scrim" aria-label="Cerrar" onClick={closeAdd} />
            <div className="friends-add-panel">
              <h2 id="friend-add-title" className="visually-hidden">
                Agregar amigo
              </h2>
              <form
                className="friends-add-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchPeople();
                }}
              >
                <label className="visually-hidden" htmlFor="friend-add">
                  Usuario GameNow o Steam
                </label>
                <div className="friends-tool-row friends-add-input">
                  <Search size={16} aria-hidden="true" />
                  <input
                    ref={addInput}
                    id="friend-add"
                    value={addQuery}
                    placeholder="Usuario, nombre Steam o código"
                    onChange={(event) => setAddQuery(event.target.value)}
                  />
                  <button type="submit" disabled={searching}>
                    {searching ? "…" : "Buscar"}
                  </button>
                </div>
              </form>
              <div className="friends-add-results" role="status">
                {addNotice ? <p>{addNotice}</p> : null}
                {searching ? <p>Buscando…</p> : null}
                {people.length > 0 ? (
                  <ul className="friends-find-list">
                    {people.map((person, index) => (
                      <li
                        key={person.steamId}
                        className="friends-find-card"
                        style={{ "--friends-i": index } as CSSProperties}
                      >
                        <div className="friends-find-bg" aria-hidden>
                          {person.miniBackgroundVideo ? (
                            <video
                              src={person.miniBackgroundVideo}
                              poster={person.miniBackgroundUrl || undefined}
                              autoPlay
                              muted
                              loop
                              playsInline
                            />
                          ) : person.miniBackgroundUrl ? (
                            <img src={person.miniBackgroundUrl} alt="" />
                          ) : null}
                          <span className="friends-find-bg-fade" />
                        </div>
                        <div className="friends-find-body">
                          {person.avatarUrl ? (
                            <img className="friends-find-avatar" src={person.avatarUrl} alt="" />
                          ) : (
                            <span className="friends-find-avatar" />
                          )}
                          <span className="friends-find-copy">
                            <strong>{person.name}</strong>
                            {person.username ? (
                              <small>@{person.username}</small>
                            ) : (
                              <small>{person.source === "steam" ? "Steam" : "GameNow"}</small>
                            )}
                          </span>
                          <button type="button" disabled={person.alreadyFriend} onClick={() => void addPerson(person)}>
                            {person.alreadyFriend ? "Ya es tu amigo" : "Mandar solicitud de amistad"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {showLoader ? <PageLoader label="Cargando amigos…" /> : null}

        {status === "authenticated" && !loading && friends.length === 0 && requests.length === 0 && !user?.steamId ? (
          <p className="friends-empty">
            Todavía no hay amigos. Agrega a alguien con su usuario de GameNow o vincula Steam en tu{" "}
            <Link to="/profile">perfil</Link>.
          </p>
        ) : null}
        {!loading && user?.steamId && hidden && friends.length === 0 ? (
          <p className="friends-empty">Tu lista de amigos de Steam es privada. Los amigos de GameNow sí aparecen aquí.</p>
        ) : null}
        {!loading && user?.steamId && !hidden && friends.length === 0 && requests.length === 0 && status === "authenticated" ? (
          <p className="friends-empty">Todavía no hay amigos en esta cuenta. Agrega a alguien con su usuario de GameNow.</p>
        ) : null}
        {!loading && friends.length > 0 && visibleFriends.length === 0 ? (
          <p className="friends-empty">Ningún amigo coincide con esa búsqueda.</p>
        ) : null}

        {!loading && (visibleFriends.length > 0 || requests.length > 0) ? (
          <div className={`friends-layout${requests.length > 0 ? " has-requests" : ""}`}>
            <div className="friends-layout-main">
              {visibleFriends.length > 0 ? (
                <ul className="friends-list">
                  {visibleFriends.map((friend, index) => {
                    const href = profilePath(friend.steamId);
                    return (
                    <li
                      key={friend.steamId}
                      className={`friends-list-item${enteringFriendIds.includes(friend.steamId) ? " is-enter-from-request" : ""}`}
                      style={{ "--friends-i": index } as CSSProperties}
                    >
                      <div className="friends-row">
                        {href ? (
                          <Link className="friends-person" to={href}>
                            {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" /> : <span />}
                            <span>
                              <strong>{friend.name}</strong>
                              <small>{friend.status}</small>
                            </span>
                          </Link>
                        ) : (
                          <div className="friends-person">
                            {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" /> : <span />}
                            <span>
                              <strong>{friend.name}</strong>
                              <small>{friend.status}</small>
                            </span>
                          </div>
                        )}
                        <div className="friends-actions">
                          <button
                            type="button"
                            className="friends-chat"
                            aria-pressed={openChat && chatFocus === friend.steamId}
                            onClick={() => {
                              setOpenInvite(null);
                              setChatFocus(friend.steamId);
                              setOpenChat(true);
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
                              setOpenChat(false);
                              setChatFocus(null);
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
                  );
                  })}
                </ul>
              ) : null}
            </div>

            {requests.length > 0 ? (
              <aside className="friends-requests" aria-labelledby="friends-requests-title">
                <h2 id="friends-requests-title">Solicitudes de amistad</h2>
                <ul className="friends-list friends-requests-list">
                  {requests.map((request, index) => {
                    const href = profilePath(request.steamId);
                    return (
                      <li
                        key={`${request.fromUserId}-${request.steamId}`}
                        className={`friends-list-item friends-request-item${
                          leavingRequestKeys.includes(`${request.fromUserId}-${request.steamId}`) ? " is-leaving" : ""
                        }`}
                        style={{ "--friends-i": index } as CSSProperties}
                      >
                        <div className="friends-row friends-request-row">
                          {href ? (
                            <Link className="friends-person" to={href}>
                              {request.avatarUrl ? <img src={request.avatarUrl} alt="" /> : <span />}
                              <span>
                                <strong>{request.name}</strong>
                                <small>{request.username ? `@${request.username}` : "Quiere ser tu amigo"}</small>
                              </span>
                            </Link>
                          ) : (
                            <div className="friends-person">
                              {request.avatarUrl ? <img src={request.avatarUrl} alt="" /> : <span />}
                              <span>
                                <strong>{request.name}</strong>
                                <small>{request.username ? `@${request.username}` : "Quiere ser tu amigo"}</small>
                              </span>
                            </div>
                          )}
                          <div className="friends-request-actions">
                            <button
                              type="button"
                              className="friends-request-accept"
                              onClick={() => void respondRequest(request, "accept")}
                            >
                              <Check size={16} aria-hidden="true" />
                              <span>Aceptar</span>
                            </button>
                            <button
                              type="button"
                              className="friends-request-reject"
                              onClick={() => void respondRequest(request, "reject")}
                            >
                              <X size={16} aria-hidden="true" />
                              <span>Rechazar</span>
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            ) : null}
          </div>
        ) : null}
      </main>
      <ChatModal
        open={openChat}
        onClose={() => {
          setOpenChat(false);
          setChatFocus(null);
        }}
        friends={friends.map((friend) => ({
          steamId: friend.steamId,
          name: friend.name,
          avatarUrl: friend.avatarUrl,
          backgroundUrl: friend.backgroundUrl,
          backgroundVideo: friend.backgroundVideo,
          playingGame: friend.playingGame,
          playingAppId: friend.playingAppId,
          playingMinutes: friend.playingMinutes,
          playingSpan: friend.playingSpan,
        }))}
        focusFriendId={chatFocus}
      />
      <Footer9 />
    </div>
  );
}
