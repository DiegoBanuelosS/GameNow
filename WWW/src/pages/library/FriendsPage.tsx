import { useEffect, useRef, useState } from "react";
import { Gamepad2, MessageCircle, Search, Star, UserMinus, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { SiteNav } from "../Store/SiteNav";
import { Footer9 } from "../Store/Footer9";
import { useAuth } from "../../data/AuthContext";
import "./FriendsPage.css";

type Person = {
  steamId: string;
  name: string;
  avatarUrl: string;
  username: string;
  alreadyFriend: boolean;
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
  const [friendQuery, setFriendQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const addInput = useRef<HTMLInputElement>(null);
  const [searching, setSearching] = useState(false);
  const [addNotice, setAddNotice] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !token) {
      setLoading(false);
      return;
    }
    let alive = true;
    fetch("/api/steam/friends", { headers: { Authorization: `Bearer ${token}` } })
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
    const response = await fetch("/api/steam/friends", {
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

  const visibleFriends = friends.filter((friend) => {
    const query = friendQuery.trim().toLowerCase();
    if (!query) return true;
    return friend.name.toLowerCase().includes(query);
  });

  useEffect(() => {
    if (!adding) return;
    addInput.current?.focus();
  }, [adding]);

  const closeAdd = () => {
    setAdding(false);
    setAddQuery("");
    setPeople([]);
    setAddNotice("");
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
      const response = await fetch(`/api/steam/people?q=${encodeURIComponent(query)}`, {
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
      setAddNotice(found.length ? "" : "No encontramos a nadie con ese usuario o código.");
    } catch {
      setAddNotice("No se pudo buscar. Revisa tu conexión.");
    } finally {
      setSearching(false);
    }
  };

  const addPerson = async (person: Person) => {
    if (!token || person.alreadyFriend) return;
    setAddNotice("");
    const response = await fetch("/api/steam/friends", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ steamId: person.steamId, username: person.username }),
    });
    const data = await response.json();
    if (!response.ok) {
      setAddNotice(data.error || "No se pudo agregar.");
      return;
    }
    setPeople((current) =>
      current.map((item) => (item.steamId === person.steamId ? { ...item, alreadyFriend: true } : item)),
    );
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
        },
        ...current,
      ];
    });
    setAddNotice(`${person.name} ya está en tus amigos.`);
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
            {adding ? (
              <form
                className="friends-tool friends-add-swap"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchPeople();
                }}
              >
                <label htmlFor="friend-add">Usuario o código de amigo</label>
                <div className="friends-tool-row">
                  <Search size={16} aria-hidden="true" />
                  <input
                    ref={addInput}
                    id="friend-add"
                    value={addQuery}
                    placeholder="Usuario o código de amigo"
                    onChange={(event) => setAddQuery(event.target.value)}
                  />
                  <button type="submit" disabled={searching}>
                    {searching ? "Buscando…" : "Buscar"}
                  </button>
                  <button type="button" className="friends-add-close" onClick={closeAdd}>
                    Cerrar
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="friends-add" onClick={() => setAdding(true)}>
                <UserPlus size={16} aria-hidden="true" />
                Agregar amigo
              </button>
            )}
          </div>
        ) : null}
        {people.length > 0 || addNotice ? (
          <div className="friends-results" role="status">
            {addNotice ? <p>{addNotice}</p> : null}
            {people.length > 0 ? (
              <ul>
                {people.map((person) => (
                  <li key={person.steamId}>
                    {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <span />}
                    <span>
                      <strong>{person.name}</strong>
                      {person.username ? <small>@{person.username}</small> : null}
                    </span>
                    <button type="button" disabled={person.alreadyFriend} onClick={() => void addPerson(person)}>
                      {person.alreadyFriend ? "Ya es tu amigo" : "Agregar"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
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
          <p className="friends-empty">Todavía no hay amigos en esta cuenta. Agrega a alguien con su usuario de GameNow.</p>
        ) : null}
        {!loading && friends.length > 0 && visibleFriends.length === 0 ? (
          <p className="friends-empty">Ningún amigo coincide con esa búsqueda.</p>
        ) : null}
        {visibleFriends.length > 0 ? (
          <ul className="friends-list">
            {visibleFriends.map((friend) => (
              <li key={friend.steamId}>
                <div className="friends-row">
                  {/^\d{17}$/.test(friend.steamId) ? (
                    <Link className="friends-person" to={`/perfil/${friend.steamId}`}>
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
