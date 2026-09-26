import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiUrl } from "./api";
import { useAuth } from "./AuthContext";
import { useChat } from "./ChatContext";
import { notifyDesktopHost } from "./desktopNotify";
import { useDownloads } from "./DownloadsContext";

export type FriendRequestToast = {
  id: string;
  kind: "friend-request";
  name: string;
  avatarUrl: string;
  backgroundUrl?: string;
  steamId: string;
  fromUserId: string;
};

export type GameToast = {
  id: string;
  kind: "game-downloaded" | "game-ready";
  name: string;
  cover: string;
  slug: string;
};

export type MessageToast = {
  id: string;
  kind: "message";
  name: string;
  avatarUrl: string;
  text: string;
  roomId: string;
};

export type AppToast = FriendRequestToast | GameToast | MessageToast;

type ToastInput =
  | (Omit<FriendRequestToast, "id"> & { id?: string })
  | (Omit<GameToast, "id"> & { id?: string })
  | (Omit<MessageToast, "id"> & { id?: string });

type NotificationsContextType = {
  items: AppToast[];
  dismiss: (id: string) => void;
  respondFriendRequest: (id: string, action: "accept" | "reject") => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType | null>(null);

const AUTO_MS: Record<AppToast["kind"], number> = {
  "friend-request": 18_000,
  "game-downloaded": 7_000,
  "game-ready": 7_000,
  message: 8_000,
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { token, status, user } = useAuth();
  const { jobs } = useDownloads();
  const { rooms, refreshRooms, ready: chatReady } = useChat();
  const [items, setItems] = useState<AppToast[]>([]);
  const timers = useRef(new Map<string, number>());
  const seenReady = useRef(new Set<string>());
  const seenDone = useRef(new Set<string>());
  const knownRequests = useRef<Set<string> | null>(null);
  const knownMessages = useRef<Map<string, number> | null>(null);
  const seededJobs = useRef(false);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = toast.id || uid(toast.kind);
      let added = true;
      setItems((current) => {
        if (toast.kind === "friend-request") {
          const exists = current.some(
            (item) =>
              item.kind === "friend-request" &&
              item.steamId === toast.steamId &&
              item.fromUserId === toast.fromUserId,
          );
          if (exists) {
            added = false;
            return current;
          }
        }
        if (toast.kind === "game-downloaded" || toast.kind === "game-ready") {
          const exists = current.some(
            (item) =>
              (item.kind === "game-downloaded" || item.kind === "game-ready") &&
              item.kind === toast.kind &&
              item.slug === toast.slug,
          );
          if (exists) {
            added = false;
            return current;
          }
        }
        return [{ ...toast, id } as AppToast, ...current].slice(0, 5);
      });
      if (!added) return id;

      notifyDesktopHost({ ...toast, id });

      const existing = timers.current.get(id);
      if (existing) window.clearTimeout(existing);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), AUTO_MS[toast.kind]),
      );
      return id;
    },
    [dismiss],
  );

  const respondFriendRequest = useCallback(
    async (id: string, action: "accept" | "reject") => {
      const toast = items.find((item) => item.id === id && item.kind === "friend-request");
      if (!toast || toast.kind !== "friend-request" || !token) return;
      dismiss(id);
      try {
        await fetch(apiUrl("/api/steam/friends"), {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ steamId: toast.steamId, action }),
        });
      } catch {
        /* la UI ya cerró el toast */
      }
    },
    [dismiss, items, token],
  );

  useEffect(() => {
    const respond = (id: string, action: "accept" | "reject") => {
      void respondFriendRequest(id, action);
    };
    (window as unknown as { __gamenowRespondFriend?: typeof respond }).__gamenowRespondFriend = respond;
    return () => {
      delete (window as unknown as { __gamenowRespondFriend?: typeof respond }).__gamenowRespondFriend;
    };
  }, [respondFriendRequest]);

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      knownRequests.current = null;
      knownMessages.current = null;
      seededJobs.current = false;
      seenReady.current.clear();
      seenDone.current.clear();
      setItems([]);
    }
  }, [status]);

  useEffect(() => {
    if (!seededJobs.current) {
      for (const job of jobs) {
        const percent = job.bytesTotal > 0 ? (job.bytesDone / job.bytesTotal) * 100 : 0;
        if (percent >= 28 || job.status === "done") seenReady.current.add(job.slug);
        if (job.status === "done") seenDone.current.add(job.slug);
      }
      seededJobs.current = true;
      return;
    }

    for (const job of jobs) {
      const percent = job.bytesTotal > 0 ? (job.bytesDone / job.bytesTotal) * 100 : 0;
      if (percent >= 28 && !seenReady.current.has(job.slug)) {
        seenReady.current.add(job.slug);
        push({
          kind: "game-ready",
          name: job.name,
          cover: job.cover,
          slug: job.slug,
        });
      }
      if (job.status === "done" && !seenDone.current.has(job.slug)) {
        seenDone.current.add(job.slug);
        seenReady.current.add(job.slug);
        push({
          kind: "game-downloaded",
          name: job.name,
          cover: job.cover,
          slug: job.slug,
        });
      }
    }
  }, [jobs, push]);

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    let alive = true;

    const poll = async () => {
      try {
        const response = await fetch(apiUrl("/api/steam/friends"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          requests?: {
            fromUserId: string;
            steamId: string;
            name: string;
            avatarUrl: string;
            backgroundUrl?: string;
            at?: number;
          }[];
        };
        if (!alive) return;
        const list = data.requests ?? [];
        const keys = new Set(list.map((item) => `${item.fromUserId}-${item.steamId}`));
        if (!knownRequests.current) {
          knownRequests.current = keys;
          return;
        }
        for (const request of list) {
          const key = `${request.fromUserId}-${request.steamId}`;
          if (knownRequests.current.has(key)) continue;
          push({
            kind: "friend-request",
            name: request.name || "Jugador",
            avatarUrl: request.avatarUrl || "",
            backgroundUrl: request.backgroundUrl || "",
            steamId: request.steamId,
            fromUserId: request.fromUserId,
          });
        }
        knownRequests.current = keys;
      } catch {
        /* silencioso */
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 12_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [push, status, token]);

  useEffect(() => {
    if (status !== "authenticated" || !token || !chatReady) return;
    let alive = true;
    const tick = async () => {
      try {
        await refreshRooms();
      } catch {
        /* silencioso */
      }
    };
    void tick();
    const timer = window.setInterval(() => {
      if (alive) void tick();
    }, 8_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [chatReady, refreshRooms, status, token]);

  useEffect(() => {
    if (status !== "authenticated" || !user?._id) return;
    if (!knownMessages.current) {
      knownMessages.current = new Map(
        rooms.map((room) => [room.id, room.lastMessage?.at ?? 0] as const),
      );
      return;
    }

    for (const room of rooms) {
      const last = room.lastMessage;
      if (!last?.at) continue;
      const previous = knownMessages.current.get(room.id) ?? 0;
      if (last.at <= previous) continue;
      knownMessages.current.set(room.id, last.at);
      if (last.senderId === user._id) continue;
      const sender =
        room.members.find((member) => member.id === last.senderId) ||
        room.members.find((member) => member.id !== user._id);
      const preview = (last.text || "").trim() || (last.imageUrl ? "📷 Imagen" : "");
      if (!preview) continue;
      push({
        kind: "message",
        name: sender?.name || room.title || "Mensaje",
        avatarUrl: sender?.avatarUrl || "",
        text: preview,
        roomId: room.id,
      });
    }

    for (const room of rooms) {
      if (!knownMessages.current.has(room.id)) {
        knownMessages.current.set(room.id, room.lastMessage?.at ?? 0);
      }
    }
  }, [push, rooms, status, user?._id]);

  const value = useMemo(
    () => ({ items, dismiss, respondFriendRequest }),
    [dismiss, items, respondFriendRequest],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications fuera de NotificationsProvider");
  return value;
}
