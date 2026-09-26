import { Check, X } from "lucide-react";
import { hasDesktopHost } from "../data/desktopNotify";
import { useNotifications, type AppToast } from "../data/NotificationsContext";
import "./ToastNotifications.css";

function FriendToast({
  item,
  onAccept,
  onReject,
}: {
  item: Extract<AppToast, { kind: "friend-request" }>;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <article className="gn-toast gn-toast--friend" role="status">
      {item.backgroundUrl ? (
        <div
          className="gn-toast-friend-bg"
          style={{ backgroundImage: `url(${item.backgroundUrl})` }}
          aria-hidden
        />
      ) : item.avatarUrl ? (
        <div
          className="gn-toast-friend-bg gn-toast-friend-bg--avatar"
          style={{ backgroundImage: `url(${item.avatarUrl})` }}
          aria-hidden
        />
      ) : null}
      <p className="gn-toast-eyebrow">Nueva solicitud de amistad</p>
      <div className="gn-toast-friend-row">
        <div className="gn-toast-avatar">
          {item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : <span aria-hidden />}
        </div>
        <p className="gn-toast-name">{item.name}</p>
        <div className="gn-toast-actions">
          <button type="button" className="gn-toast-accept" onClick={onAccept} aria-label="Aceptar">
            <Check size={16} strokeWidth={2.4} />
            <span>Aceptar</span>
          </button>
          <button type="button" className="gn-toast-reject" onClick={onReject} aria-label="Rechazar">
            <X size={16} strokeWidth={2.4} />
            <span>Rechazar</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function GameToastCard({
  item,
}: {
  item: Extract<AppToast, { kind: "game-downloaded" | "game-ready" }>;
}) {
  const label = item.kind === "game-downloaded" ? "Descargado" : "Listo para jugar";
  return (
    <article className="gn-toast gn-toast--game" role="status">
      <div className="gn-toast-cover-wrap">
        {item.cover ? (
          <img className="gn-toast-cover" src={item.cover} alt="" />
        ) : (
          <span className="gn-toast-cover gn-toast-cover--empty" />
        )}
        <span className="gn-toast-cover-fade" aria-hidden />
      </div>
      <div className="gn-toast-game-copy">
        <p className="gn-toast-name">{item.name}</p>
        <p className="gn-toast-sub">{label}</p>
      </div>
    </article>
  );
}

function MessageToastCard({ item }: { item: Extract<AppToast, { kind: "message" }> }) {
  return (
    <article className="gn-toast gn-toast--message" role="status">
      <div className="gn-toast-message-head">
        <div className="gn-toast-avatar">
          {item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : <span aria-hidden />}
        </div>
        <p className="gn-toast-name">{item.name}</p>
      </div>
      <p className="gn-toast-message-body">{item.text}</p>
    </article>
  );
}

export function ToastNotifications() {
  const { items, respondFriendRequest } = useNotifications();
  // En la app de escritorio el host Flutter muestra los mismos toasts personalizados.
  if (hasDesktopHost()) return null;
  if (!items.length) return null;

  return (
    <div className="gn-toast-stack" aria-live="polite">
      {items.map((item) => {
        if (item.kind === "friend-request") {
          return (
            <FriendToast
              key={item.id}
              item={item}
              onAccept={() => void respondFriendRequest(item.id, "accept")}
              onReject={() => void respondFriendRequest(item.id, "reject")}
            />
          );
        }
        if (item.kind === "message") {
          return <MessageToastCard key={item.id} item={item} />;
        }
        return <GameToastCard key={item.id} item={item} />;
      })}
    </div>
  );
}
