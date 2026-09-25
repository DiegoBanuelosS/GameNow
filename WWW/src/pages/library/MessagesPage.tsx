import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Users } from "lucide-react";
import { AuthRequiredGate } from "../../components/AuthRequiredGate";
import { apiUrl } from "../../data/api";
import { useAuth } from "../../data/AuthContext";
import { SiteNav } from "../Store/SiteNav";
import { ChatModal, type ChatFriend } from "./ChatModal";

type FriendRow = {
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

export function MessagesPage() {
  const navigate = useNavigate();
  const { token, status } = useAuth();
  const [friends, setFriends] = useState<ChatFriend[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    let alive = true;
    fetch(apiUrl("/api/steam/friends"), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "amigos");
        return data as { friends?: FriendRow[] };
      })
      .then((data) => {
        if (!alive) return;
        setFriends(
          (data.friends ?? []).map((friend) => ({
            steamId: friend.steamId,
            name: friend.name,
            avatarUrl: friend.avatarUrl,
            backgroundUrl: friend.backgroundUrl,
            backgroundVideo: friend.backgroundVideo,
            playingGame: friend.playingGame,
            playingAppId: friend.playingAppId,
            playingMinutes: friend.playingMinutes,
            playingSpan: friend.playingSpan,
          })),
        );
      })
      .catch(() => {
        if (alive) setFriends([]);
      });
    return () => {
      alive = false;
    };
  }, [status, token]);

  if (status === "loading") {
    return (
      <div className="friends-page">
        <SiteNav />
        <main className="friends-main">
          <p className="friends-empty">Cargando mensajes…</p>
        </main>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="friends-page">
        <SiteNav />
        <AuthRequiredGate
          title="Inicia sesión para ver tus mensajes"
          description="Tus conversaciones están privadas. Entra con tu cuenta de GameNow para abrir el chat cifrado con tus amigos."
          features={[
            {
              icon: <MessageCircle size={16} aria-hidden="true" />,
              label: "Mensajes cifrados de extremo a extremo",
            },
            {
              icon: <Users size={16} aria-hidden="true" />,
              label: "Conversaciones con tus amigos de GameNow",
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="friends-page">
      <SiteNav />
      <ChatModal
        open={open}
        onClose={() => {
          setOpen(false);
          navigate(-1);
        }}
        friends={friends}
      />
    </div>
  );
}
