import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiUrl } from "./api";
import { useAuth } from "./AuthContext";
import {
  cachedRoomKey,
  createRoomKey,
  decryptMessage,
  encryptMessage,
  ensureIdentity,
  setCachedRoomKey,
  unwrapRoomKey,
  wrapRoomKeyFor,
  type WrappedRoomKey,
} from "./chatCrypto";

export type ChatMember = {
  id: string;
  steamId?: string;
  name: string;
  avatarUrl: string;
  backgroundUrl?: string;
  backgroundVideo?: string;
};

export type ChatRoom = {
  id: string;
  type: "dm" | "group";
  title: string;
  memberIds: string[];
  members: ChatMember[];
  wrappedKeys: WrappedRoomKey[];
  createdBy: string;
  lastMessage?: {
    senderId: string;
    ciphertext: string;
    iv: string;
    at: number;
    text?: string;
  } | null;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  ciphertext: string;
  iv: string;
  at: number;
  text?: string;
};

type ChatContextValue = {
  ready: boolean;
  rooms: ChatRoom[];
  refreshRooms: () => Promise<void>;
  openDm: (otherUserId: string) => Promise<ChatRoom | null>;
  createGroup: (title: string, memberIds: string[]) => Promise<ChatRoom | null>;
  loadMessages: (roomId: string, since?: number) => Promise<ChatMessage[]>;
  sendMessage: (roomId: string, text: string) => Promise<ChatMessage | null>;
  resolveRoomKey: (room: ChatRoom) => Promise<CryptoKey | null>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

async function fetchJson<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "chat");
  return data as T;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token, status } = useAuth();
  const [ready, setReady] = useState(false);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const identityRef = useRef<Awaited<ReturnType<typeof ensureIdentity>> | null>(null);

  const publishKeys = useCallback(async () => {
    if (!user?._id || !token) {
      identityRef.current = null;
      setReady(false);
      return;
    }
    const identity = await ensureIdentity(user._id);
    identityRef.current = identity;
    await fetchJson("/api/chat/keys", token, {
      method: "PUT",
      body: JSON.stringify({ publicKeyJwk: identity.publicKeyJwk }),
    });
    setReady(true);
  }, [token, user?._id]);

  useEffect(() => {
    if (status !== "authenticated") {
      setReady(false);
      setRooms([]);
      return;
    }
    void publishKeys().catch(() => setReady(false));
  }, [status, publishKeys]);

  const fetchPublicKey = useCallback(
    async (memberId: string) => {
      if (!token) throw new Error("No autorizado.");
      const data = await fetchJson<{ publicKeyJwk: JsonWebKey }>(`/api/chat/keys/${memberId}`, token);
      return data.publicKeyJwk;
    },
    [token],
  );

  const wrapForMembers = useCallback(
    async (memberIds: string[], roomKey: CryptoKey) => {
      const wraps: WrappedRoomKey[] = [];
      for (const memberId of memberIds) {
        const publicKeyJwk =
          memberId === user?._id ? identityRef.current!.publicKeyJwk : await fetchPublicKey(memberId);
        wraps.push(await wrapRoomKeyFor(roomKey, publicKeyJwk, memberId));
      }
      return wraps;
    },
    [fetchPublicKey, user?._id],
  );

  const resolveRoomKey = useCallback(async (room: ChatRoom) => {
    const cached = cachedRoomKey(room.id);
    if (cached) return cached;
    const identity = identityRef.current;
    if (!identity || !user?._id) return null;
    const wrap = room.wrappedKeys.find((item) => item.userId === user._id);
    if (!wrap) return null;
    const key = await unwrapRoomKey(wrap, identity.privateKey);
    setCachedRoomKey(room.id, key);
    return key;
  }, [user?._id]);

  const refreshRooms = useCallback(async () => {
    if (!token) return;
    const data = await fetchJson<{ rooms: ChatRoom[] }>("/api/chat/rooms", token);
    const next = await Promise.all(
      data.rooms.map(async (room) => {
        if (!room.lastMessage?.ciphertext || !room.lastMessage.iv) return room;
        try {
          const key = await resolveRoomKey(room);
          if (!key) return { ...room, lastMessage: { ...room.lastMessage, text: "" } };
          const text = await decryptMessage(key, room.lastMessage.iv, room.lastMessage.ciphertext);
          return { ...room, lastMessage: { ...room.lastMessage, text } };
        } catch {
          return { ...room, lastMessage: { ...room.lastMessage, text: "" } };
        }
      }),
    );
    setRooms(next);
  }, [resolveRoomKey, token]);

  const openDm = useCallback(
    async (otherRef: string) => {
      if (!token || !user?._id || !identityRef.current) return null;
      await publishKeys();
      const looked = await fetchJson<{ id: string }>(`/api/chat/lookup/${encodeURIComponent(otherRef)}`, token);
      const otherUserId = looked.id;
      const memberIds = [user._id, otherUserId];
      const roomKey = await createRoomKey();
      const wrappedKeys = await wrapForMembers(memberIds, roomKey);
      const data = await fetchJson<{ room: ChatRoom; created: boolean }>("/api/chat/rooms", token, {
        method: "POST",
        body: JSON.stringify({ type: "dm", memberIds: [otherUserId], wrappedKeys }),
      });
      if (data.created) setCachedRoomKey(data.room.id, roomKey);
      else await resolveRoomKey(data.room);
      await refreshRooms();
      return data.room;
    },
    [publishKeys, refreshRooms, resolveRoomKey, token, user?._id, wrapForMembers],
  );

  const createGroup = useCallback(
    async (title: string, memberRefs: string[]) => {
      if (!token || !user?._id || !identityRef.current) return null;
      await publishKeys();
      const unique = new Set<string>([user._id]);
      for (const ref of memberRefs) {
        const looked = await fetchJson<{ id: string }>(`/api/chat/lookup/${encodeURIComponent(ref)}`, token);
        unique.add(looked.id);
      }
      const memberIds = [...unique];
      const roomKey = await createRoomKey();
      const wrappedKeys = await wrapForMembers(memberIds, roomKey);
      const data = await fetchJson<{ room: ChatRoom }>("/api/chat/rooms", token, {
        method: "POST",
        body: JSON.stringify({ type: "group", title, memberIds, wrappedKeys }),
      });
      setCachedRoomKey(data.room.id, roomKey);
      await refreshRooms();
      return data.room;
    },
    [publishKeys, refreshRooms, token, user?._id, wrapForMembers],
  );

  const loadMessages = useCallback(
    async (roomId: string, since = 0) => {
      if (!token) return [];
      const room = rooms.find((item) => item.id === roomId);
      const data = await fetchJson<{ messages: ChatMessage[] }>(
        `/api/chat/rooms/${roomId}/messages?since=${since}`,
        token,
      );
      const key = room ? await resolveRoomKey(room) : cachedRoomKey(roomId);
      const decoded: ChatMessage[] = [];
      for (const message of data.messages) {
        let text = "";
        if (key) {
          try {
            text = await decryptMessage(key, message.iv, message.ciphertext);
          } catch {
            text = "No se pudo descifrar este mensaje.";
          }
        } else {
          text = "Abre el chat en este dispositivo para descifrar.";
        }
        decoded.push({ ...message, text });
      }
      return decoded;
    },
    [resolveRoomKey, rooms, token],
  );

  const sendMessage = useCallback(
    async (roomId: string, text: string) => {
      if (!token || !user?._id) return null;
      const room = rooms.find((item) => item.id === roomId);
      if (!room) return null;
      const key = await resolveRoomKey(room);
      if (!key) return null;
      const payload = await encryptMessage(key, text);
      const data = await fetchJson<{ message: ChatMessage }>(`/api/chat/rooms/${roomId}/messages`, token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const message = { ...data.message, text };
      setRooms((current) =>
        current.map((item) =>
          item.id === roomId
            ? {
                ...item,
                lastMessage: {
                  senderId: message.senderId,
                  ciphertext: message.ciphertext,
                  iv: message.iv,
                  at: message.at,
                  text,
                },
              }
            : item,
        ),
      );
      return message;
    },
    [resolveRoomKey, rooms, token, user?._id],
  );

  const value = useMemo(
    () => ({
      ready,
      rooms,
      refreshRooms,
      openDm,
      createGroup,
      loadMessages,
      sendMessage,
      resolveRoomKey,
    }),
    [ready, rooms, refreshRooms, openDm, createGroup, loadMessages, sendMessage, resolveRoomKey],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat fuera de ChatProvider");
  return value;
}
