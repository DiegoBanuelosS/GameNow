import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type MouseEvent } from "react";
import { Check, ImagePlus, Lock, MessageCircle, MessageSquarePlus, Pencil, Trash2, Users, X } from "lucide-react";
import { apiUrl } from "../../data/api";
import { useAuth } from "../../data/AuthContext";
import { useChat, type ChatMessage, type ChatRoom } from "../../data/ChatContext";
import "./ChatModal.css";

export type ChatFriend = {
  steamId: string;
  name: string;
  avatarUrl: string;
  backgroundUrl?: string;
  backgroundVideo?: string;
  playingGame?: string;
  playingAppId?: string;
  playingMinutes?: number;
  playingSpan?: "" | "week" | "total";
};

type ListRow = {
  key: string;
  name: string;
  avatarUrl: string;
  backgroundUrl: string;
  preview: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
};

function roomLabel(room: ChatRoom, meId: string) {
  if (room.type === "group") return room.title || "Grupo";
  const other = room.members.find((member) => member.id !== meId);
  return other?.name || "Chat";
}

function roomPeer(room: ChatRoom, meId: string) {
  if (room.type === "group") return null;
  return room.members.find((member) => member.id !== meId) || null;
}

function formatPlay(minutes: number, span: ChatFriend["playingSpan"]) {
  if (!minutes) return "";
  const amount = minutes < 60 ? `${minutes} min` : `${Math.round((minutes / 60) * 10) / 10} h`;
  if (span === "week") return `${amount} esta semana`;
  if (span === "total") return `${amount} en total`;
  return amount;
}

function playingCover(appId: string, step = 0) {
  if (!appId) return "";
  const file = step === 0 ? "header.jpg" : "capsule_231x87.jpg";
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/${file}`;
}

function matchFriend(friends: ChatFriend[], member: { id: string; steamId?: string; name: string }) {
  return (
    friends.find((friend) => friend.steamId === `user:${member.id}`) ||
    friends.find((friend) => member.steamId && friend.steamId === member.steamId) ||
    friends.find((friend) => friend.name.toLowerCase() === member.name.toLowerCase()) ||
    null
  );
}

function findRoomForFriend(rooms: ChatRoom[], friend: ChatFriend, meId: string) {
  return (
    rooms.find((room) => {
      if (room.type !== "dm") return false;
      const peer = roomPeer(room, meId);
      if (!peer) return false;
      return (
        friend.steamId === `user:${peer.id}` ||
        (peer.steamId && friend.steamId === peer.steamId) ||
        friend.name.toLowerCase() === peer.name.toLowerCase()
      );
    }) || null
  );
}

function RoomRow({
  row,
  leaving,
  entering,
  index,
  onContextMenu,
}: {
  row: ListRow;
  leaving?: boolean;
  entering?: boolean;
  index: number;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <li
      className={`chat-room-item${leaving ? " is-leaving" : entering ? " is-enter" : ""}`}
      style={{ "--chat-row-i": index } as CSSProperties}
    >
      <button
        type="button"
        className={`chat-room-btn${row.active ? " is-active" : ""}`}
        disabled={row.disabled}
        onClick={row.onClick}
        onContextMenu={onContextMenu}
      >
        {row.avatarUrl ? <img className="chat-room-avatar" src={row.avatarUrl} alt="" /> : <span className="chat-room-avatar" />}
        <span className="chat-room-copy">
          <strong>{row.name}</strong>
          <small>{row.preview}</small>
        </span>
        <span className="chat-room-bg" aria-hidden>
          {row.backgroundUrl ? <img src={row.backgroundUrl} alt="" /> : null}
          <span className="chat-room-bg-fade" />
        </span>
      </button>
    </li>
  );
}

export function ChatModal({
  open,
  onClose,
  friends,
  focusFriendId,
}: {
  open: boolean;
  onClose: () => void;
  friends: ChatFriend[];
  focusFriendId?: string | null;
}) {
  const { user, token } = useAuth();
  const { ready, rooms, refreshRooms, openDm, createGroup, loadMessages, sendMessage, uploadImage, editMessage, deleteMessage, deleteRoom } = useChat();
  const openDmRef = useRef(openDm);
  openDmRef.current = openDm;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupPick, setGroupPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pickingFriend, setPickingFriend] = useState(false);
  const [leavingPick, setLeavingPick] = useState(false);
  const [peerBgOverride, setPeerBgOverride] = useState<{ url: string; video: string }>({ url: "", video: "" });
  const [myBgOverride, setMyBgOverride] = useState<{ url: string; video: string }>({ url: "", video: "" });
  const [menu, setMenu] = useState<
    | { kind: "message"; messageId: string; mine: boolean; x: number; y: number }
    | { kind: "room"; roomId: string; x: number; y: number }
    | null
  >(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [animIds, setAnimIds] = useState<Record<string, "send" | "receive">>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | null>(null);
  const meId = user?._id || "";
  const myAvatar = user?.steamAvatarUrl || user?.avatarUrl || "";
  const myName = user?.steamName || user?.username || "Tú";
  const myBackgroundUrl = myBgOverride.url || user?.steamBackgroundUrl || "";
  const myBackgroundVideo = myBgOverride.video || user?.steamBackgroundVideo || "";
  const mySteamId = user?.steamId || "";

  const chatFriends = useMemo(() => friends, [friends]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void refreshRooms().catch(() => setNotice("No se pudieron cargar las conversaciones."));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    };
  }, [open, onClose, refreshRooms]);

  useEffect(() => {
    if (!open || !focusFriendId) return;
    let alive = true;
    setBusy(true);
    setNotice("");
    openDmRef.current(focusFriendId)
      .then((room) => {
        if (alive && room) setActiveId(room.id);
      })
      .catch((error: Error) => {
        if (alive) setNotice(error.message || "No se pudo abrir el chat.");
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [open, focusFriendId]);

  useEffect(() => {
    if (!open || !activeId) return;
    let alive = true;
    let since = 0;

    const pull = async () => {
      try {
        const batch = await loadMessages(activeId, since);
        if (!alive || !batch.length) return;
        since = Math.max(since, ...batch.map((message) => message.at));
        setMessages((current) => {
          const ids = new Set(current.map((message) => message.id));
          const next = batch.filter((message) => !ids.has(message.id));
          if (!next.length) return current;
          const incoming = next.filter((message) => message.senderId !== meId);
          if (incoming.length) {
            setAnimIds((prev) => {
              const copy = { ...prev };
              for (const message of incoming) copy[message.id] = "receive";
              return copy;
            });
            window.setTimeout(() => {
              setAnimIds((prev) => {
                const copy = { ...prev };
                for (const message of incoming) delete copy[message.id];
                return copy;
              });
            }, 520);
          }
          return [...current, ...next];
        });
      } catch {
        /* poll silencioso */
      }
    };

    setMessages([]);
    setAnimIds({});
    setPendingImage(null);
    void pull();
    const timer = window.setInterval(() => void pull(), 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [open, activeId, loadMessages, meId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeId]);

  useEffect(() => {
    if (!open || !token || !mySteamId) return;
    if (user?.steamBackgroundUrl || user?.steamBackgroundVideo) return;
    let alive = true;
    fetch(apiUrl(`/api/steam/profile/${mySteamId}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !alive) return;
        const url = String((data as { backgroundUrl?: string }).backgroundUrl || "");
        const video = String((data as { backgroundVideo?: string }).backgroundVideo || "");
        if (url || video) setMyBgOverride({ url, video });
      })
      .catch(() => {
        /* silencioso */
      });
    return () => {
      alive = false;
    };
  }, [open, token, mySteamId, user?.steamBackgroundUrl, user?.steamBackgroundVideo]);

  useEffect(() => {
    setPeerBgOverride({ url: "", video: "" });
    if (!open || !activeId || !token) return;
    const room = rooms.find((item) => item.id === activeId);
    const other = room ? roomPeer(room, meId) : null;
    const friend = other ? matchFriend(friends, other) : null;
    const knownUrl = other?.backgroundUrl || friend?.backgroundUrl || "";
    const knownVideo = other?.backgroundVideo || friend?.backgroundVideo || "";
    if (knownUrl || knownVideo) {
      setPeerBgOverride({ url: knownUrl, video: knownVideo });
      return;
    }
    const steamId = other?.steamId || (friend?.steamId?.match(/^\d{17}$/) ? friend.steamId : "");
    if (!steamId) return;
    let alive = true;
    fetch(apiUrl(`/api/steam/profile/${steamId}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        if (!alive) return;
        setPeerBgOverride({
          url: String((data as { backgroundUrl?: string }).backgroundUrl || ""),
          video: String((data as { backgroundVideo?: string }).backgroundVideo || ""),
        });
      })
      .catch(() => {
        /* silencioso */
      });
    return () => {
      alive = false;
    };
  }, [open, activeId, token, rooms, friends, meId]);

  if (!open) return null;

  const active = rooms.find((room) => room.id === activeId) || null;
  const peer = active ? roomPeer(active, meId) : null;
  const peerFriend = peer ? matchFriend(chatFriends, peer) : null;
  const peerBackgroundUrl = peerBgOverride.url || peer?.backgroundUrl || peerFriend?.backgroundUrl || "";
  const peerBackgroundVideo = peerBgOverride.video || peer?.backgroundVideo || peerFriend?.backgroundVideo || "";
  const showPeerBg = Boolean(active && peer && (peerBackgroundUrl || peerBackgroundVideo));
  const showMyBg = Boolean(myBackgroundUrl || myBackgroundVideo);
  const playingGame = peerFriend?.playingGame || "";
  const playingAppId = peerFriend?.playingAppId || "";
  const playingLabel = peerFriend?.playingMinutes
    ? formatPlay(peerFriend.playingMinutes, peerFriend.playingSpan)
    : "";
  const showPick = pickingFriend || leavingPick;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if ((!text && !pendingImage) || !activeId || busy) return;
    setDraft("");
    const imagePreview = pendingImage;
    setPendingImage(null);
    setBusy(true);
    try {
      let imageUrl = "";
      if (imagePreview) {
        imageUrl = await uploadImage(imagePreview);
      }
      const message = await sendMessage(activeId, text, imageUrl);
      if (message) {
        setMessages((current) => [...current, message]);
        setAnimIds((prev) => ({ ...prev, [message.id]: "send" }));
        window.setTimeout(() => {
          setAnimIds((prev) => {
            const copy = { ...prev };
            delete copy[message.id];
            return copy;
          });
        }, 520);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se envió el mensaje.");
      setDraft(text);
      if (imagePreview) setPendingImage(imagePreview);
    } finally {
      setBusy(false);
    }
  };

  const onPickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2_500_000) {
      setNotice("La imagen debe pesar menos de 2.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        setNotice("No se pudo leer la imagen.");
        return;
      }
      setPendingImage(result);
      setNotice("");
    };
    reader.onerror = () => setNotice("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  };

  const makeGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!groupTitle.trim() || groupPick.length === 0) return;
    setBusy(true);
    setNotice("");
    try {
      const room = await createGroup(groupTitle.trim(), groupPick);
      if (room) {
        setActiveId(room.id);
        setCreatingGroup(false);
        setGroupTitle("");
        setGroupPick([]);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se creó el grupo.");
    } finally {
      setBusy(false);
    }
  };

  const toggleFriend = (steamId: string) => {
    setGroupPick((current) =>
      current.includes(steamId) ? current.filter((id) => id !== steamId) : [...current, steamId],
    );
  };

  const closePick = () => {
    if (!pickingFriend || leavingPick) return;
    setLeavingPick(true);
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setPickingFriend(false);
      setLeavingPick(false);
      leaveTimer.current = null;
    }, 320);
  };

  const openPick = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    setLeavingPick(false);
    setPickingFriend(true);
    setCreatingGroup(false);
  };

  const startWithFriend = async (steamId: string) => {
    setBusy(true);
    setNotice("");
    closePick();
    try {
      const room = await openDm(steamId);
      if (room) setActiveId(room.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo abrir el chat.");
    } finally {
      setBusy(false);
    }
  };

  const openMessageMenu = (event: MouseEvent, message: ChatMessage) => {
    event.preventDefault();
    setMenu({
      kind: "message",
      messageId: message.id,
      mine: message.senderId === meId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const openRoomMenu = (event: MouseEvent, roomId: string) => {
    event.preventDefault();
    setMenu({ kind: "room", roomId, x: event.clientX, y: event.clientY });
  };

  const saveEdit = async () => {
    if (!activeId || !editingId || !editDraft.trim()) return;
    setBusy(true);
    try {
      const updated = await editMessage(activeId, editingId, editDraft.trim());
      if (updated) {
        setMessages((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      }
      setEditingId(null);
      setEditDraft("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo editar.");
    } finally {
      setBusy(false);
    }
  };

  const removeMessage = async (messageId: string) => {
    if (!activeId) return;
    setBusy(true);
    setMenu(null);
    try {
      await deleteMessage(activeId, messageId);
      setMessages((current) => current.filter((item) => item.id !== messageId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  };

  const removeRoom = async (roomId: string) => {
    setBusy(true);
    setMenu(null);
    try {
      await deleteRoom(roomId);
      if (activeId === roomId) {
        setActiveId(null);
        setMessages([]);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo eliminar el chat.");
    } finally {
      setBusy(false);
    }
  };

  const roomRows: ListRow[] = rooms.map((room) => {
    const other = roomPeer(room, meId);
    const friend = other ? matchFriend(chatFriends, other) : null;
    const preview =
      room.lastMessage?.text?.trim() ||
      (room.type === "group" ? `${room.memberIds.length} miembros` : "Sin mensajes todavía");
    return {
      key: room.id,
      name: roomLabel(room, meId),
      avatarUrl: other?.avatarUrl || friend?.avatarUrl || "",
      backgroundUrl: other?.backgroundUrl || friend?.backgroundUrl || "",
      preview,
      active: room.id === activeId,
      onClick: () => setActiveId(room.id),
    };
  });

  const friendRows: ListRow[] = chatFriends.map((friend) => {
    const room = findRoomForFriend(rooms, friend, meId);
    const peerMember = room ? roomPeer(room, meId) : null;
    const preview = room?.lastMessage?.text?.trim() || "Iniciar conversación";
    return {
      key: friend.steamId,
      name: friend.name,
      avatarUrl: friend.avatarUrl || peerMember?.avatarUrl || "",
      backgroundUrl: friend.backgroundUrl || peerMember?.backgroundUrl || "",
      preview,
      active: room?.id === activeId,
      disabled: busy,
      onClick: () => void startWithFriend(friend.steamId),
    };
  });

  const listRows = showPick ? friendRows : roomRows;

  return (
    <div className="chat-modal" role="dialog" aria-modal="true" aria-labelledby="chat-modal-title">
      <div className="chat-modal-panel">
        {showMyBg ? (
          <div className="chat-modal-shell-bg" aria-hidden>
            {myBackgroundVideo ? (
              <video
                className="chat-modal-shell-bg-media"
                src={myBackgroundVideo}
                poster={myBackgroundUrl || undefined}
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img className="chat-modal-shell-bg-media" src={myBackgroundUrl} alt="" />
            )}
            <div className="chat-modal-shell-bg-fade" />
          </div>
        ) : null}

        <div className="chat-modal-stage">
          <aside className="chat-modal-me" aria-label="Tu perfil">
            <div className="chat-modal-me-top">
              {myAvatar ? (
                <img className="chat-modal-me-avatar" src={myAvatar} alt="" />
              ) : (
                <span className="chat-modal-me-avatar is-empty" aria-hidden />
              )}
              <h2 id="chat-modal-title">{myName}</h2>
              <p className="chat-modal-lock">
                <Lock size={14} aria-hidden />
                Mensajes en tu cuenta
              </p>
              <button
                type="button"
                className={`chat-start-btn${pickingFriend ? " is-open" : ""}`}
                onClick={() => (pickingFriend ? closePick() : openPick())}
              >
                <MessageSquarePlus size={16} aria-hidden />
                Iniciar conversación
              </button>
            </div>

            <div className={`chat-rooms${!showPick && rooms.length === 0 ? " is-empty" : ""}`} aria-label="Conversaciones">
              {!showPick && rooms.length === 0 ? (
                <p className="chat-rooms-empty">Sin conversaciones todavía.</p>
              ) : listRows.length === 0 ? (
                <p className="chat-rooms-empty">Agrega amigos para iniciar un chat.</p>
              ) : (
                <ul>
                  {listRows.map((row, index) => (
                    <RoomRow
                      key={row.key}
                      row={row}
                      index={index}
                      leaving={leavingPick}
                      entering={pickingFriend && !leavingPick}
                      onContextMenu={
                        !showPick
                          ? (event) => openRoomMenu(event, row.key)
                          : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <div className="chat-modal-main">
            {showPeerBg ? (
              <div className="chat-modal-bg" aria-hidden>
                {peerBackgroundVideo ? (
                  <video
                    className="chat-modal-bg-media"
                    src={peerBackgroundVideo}
                    poster={peerBackgroundUrl || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img className="chat-modal-bg-media" src={peerBackgroundUrl} alt="" />
                )}
                <div className="chat-modal-bg-fade" />
                {playingGame ? (
                  <div className="chat-now-playing">
                    <div className="chat-now-playing-copy">
                      <strong>{playingGame}</strong>
                      {playingLabel ? <small>{playingLabel}</small> : <small>Jugando ahora</small>}
                    </div>
                    {playingAppId ? (
                      <img
                        className="chat-now-playing-cover"
                        src={playingCover(playingAppId)}
                        alt=""
                        onError={(event) => {
                          const image = event.currentTarget;
                          if (image.dataset.step !== "1") {
                            image.dataset.step = "1";
                            image.src = playingCover(playingAppId, 1);
                          }
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <header className="chat-modal-head">
              <div className="chat-modal-head-actions">
                <button
                  type="button"
                  onClick={() => {
                    setCreatingGroup((value) => !value);
                    if (pickingFriend) closePick();
                  }}
                >
                  <Users size={16} aria-hidden />
                  Crear grupo
                </button>
              </div>
            </header>

            {!ready ? <p className="chat-modal-notice">Preparando claves de esta cuenta…</p> : null}
            {notice ? (
              <p className="chat-modal-notice" role="status">
                {notice}
              </p>
            ) : null}

            {creatingGroup ? (
              <form className="chat-group-form" onSubmit={(event) => void makeGroup(event)}>
                <label>
                  Nombre del grupo
                  <input value={groupTitle} maxLength={80} onChange={(event) => setGroupTitle(event.target.value)} required />
                </label>
                <fieldset>
                  <legend>Amigos</legend>
                  {chatFriends.length === 0 ? (
                    <p>Agrega amigos para armar un grupo.</p>
                  ) : (
                    chatFriends.map((friend) => {
                      const checked = groupPick.includes(friend.steamId);
                      return (
                        <button
                          key={friend.steamId}
                          type="button"
                          className={`chat-group-pick${checked ? " is-checked" : ""}`}
                          aria-pressed={checked}
                          onClick={() => toggleFriend(friend.steamId)}
                        >
                          <span className="chat-check" aria-hidden>
                            <Check size={14} strokeWidth={2.5} />
                          </span>
                          {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" /> : <span className="chat-group-avatar" />}
                          <span>{friend.name}</span>
                        </button>
                      );
                    })
                  )}
                </fieldset>
                <button type="submit" disabled={busy || !groupTitle.trim() || groupPick.length === 0}>
                  Crear grupo cifrado
                </button>
              </form>
            ) : null}

            <section className={`chat-thread${!active ? " is-empty" : ""}`} aria-live="polite">
              {!active ? (
                <p className="chat-thread-empty">
                  <MessageCircle size={36} strokeWidth={1.6} aria-hidden />
                  <span>Elige una conversación o inicia una nueva.</span>
                </p>
              ) : (
                <>
                  <header className="chat-thread-head">
                    <h3>{roomLabel(active, meId)}</h3>
                  </header>
                  <div className="chat-thread-scroll">
                    {messages.map((message) => {
                      const mine = message.senderId === meId;
                      const member = active.members.find((item) => item.id === message.senderId);
                      const sender = member?.name || (mine ? "Tú" : "Alguien");
                      const avatar = mine ? myAvatar : member?.avatarUrl || "";
                      const editing = editingId === message.id;
                      const motion = animIds[message.id];
                      return (
                        <article
                          key={message.id}
                          className={`chat-bubble${mine ? " is-mine" : ""}${
                            motion === "send" ? " is-send" : motion === "receive" ? " is-receive" : ""
                          }`}
                          onContextMenu={(event) => openMessageMenu(event, message)}
                        >
                          {!mine ? (
                            <div className="chat-bubble-meta">
                              {avatar ? <img src={avatar} alt="" /> : <span className="chat-bubble-avatar" />}
                              <span className="chat-bubble-name">{sender}</span>
                            </div>
                          ) : null}
                          {editing ? (
                            <div className="chat-bubble-edit">
                              <input
                                value={editDraft}
                                maxLength={2000}
                                onChange={(event) => setEditDraft(event.target.value)}
                                autoFocus
                              />
                              <button type="button" onClick={() => void saveEdit()} disabled={busy || !editDraft.trim()}>
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditDraft("");
                                }}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="chat-bubble-body">
                              {message.imageUrl ? (
                                <a
                                  className="chat-bubble-image"
                                  href={message.imageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <img src={message.imageUrl} alt="Imagen enviada" />
                                </a>
                              ) : null}
                              {message.text ? (
                                <p>
                                  {message.text}
                                  {message.editedAt ? <small className="chat-edited"> (editado)</small> : null}
                                </p>
                              ) : null}
                            </div>
                          )}
                          <time dateTime={new Date(message.at).toISOString()}>
                            {new Date(message.at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                          </time>
                        </article>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                  {pendingImage ? (
                    <div className="chat-image-preview">
                      <img src={pendingImage} alt="Vista previa" />
                      <button type="button" aria-label="Quitar imagen" onClick={() => setPendingImage(null)}>
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  ) : null}
                  <form className="chat-composer" onSubmit={(event) => void submit(event)}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="visually-hidden"
                      onChange={onPickImage}
                    />
                    <button
                      type="button"
                      className="chat-attach"
                      aria-label="Adjuntar imagen"
                      disabled={busy}
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImagePlus size={18} aria-hidden />
                    </button>
                    <label className="visually-hidden" htmlFor="chat-draft">
                      Mensaje
                    </label>
                    <input
                      id="chat-draft"
                      value={draft}
                      maxLength={2000}
                      placeholder={pendingImage ? "Añade un texto (opcional)…" : "Escribe un mensaje…"}
                      onChange={(event) => setDraft(event.target.value)}
                      disabled={busy}
                    />
                    <button type="submit" disabled={busy || (!draft.trim() && !pendingImage)}>
                      Enviar
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {menu ? (
        <div
          className="chat-context-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          {menu.kind === "message" && menu.mine ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = messages.find((item) => item.id === menu.messageId);
                  setEditingId(menu.messageId);
                  setEditDraft(target?.text || "");
                  setMenu(null);
                }}
              >
                <Pencil size={15} aria-hidden="true" />
                Editar mensaje
              </button>
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => void removeMessage(menu.messageId)}
              >
                <Trash2 size={15} aria-hidden="true" />
                Eliminar mensaje
              </button>
            </>
          ) : null}
          {menu.kind === "message" && !menu.mine ? (
            <button type="button" role="menuitem" disabled>
              <Lock size={15} aria-hidden="true" />
              Solo el autor puede editar o borrar
            </button>
          ) : null}
          {menu.kind === "room" ? (
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              onClick={() => void removeRoom(menu.roomId)}
            >
              <Trash2 size={15} aria-hidden="true" />
              Eliminar chat
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
