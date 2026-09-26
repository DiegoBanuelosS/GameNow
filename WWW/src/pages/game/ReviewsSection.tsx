import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PenLine, ThumbsUp } from "lucide-react";
import { apiUrl } from "../../data/api";
import { useAuth } from "../../data/AuthContext";
import { Star } from "../../components/Icons";
import { StarRating } from "../Store/StarRating";
import "./ReviewsSection.css";

type Review = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  helpful: number;
};

async function fetchReviews(slug: string): Promise<Review[]> {
  const res = await fetch(apiUrl(`/api/reviews/${slug}`));
  if (!res.ok) throw new Error("error");
  return res.json() as Promise<Review[]>;
}

async function postReview(
  slug: string,
  token: string,
  rating: number,
  text: string,
): Promise<{ review?: Review; error?: string; status: number }> {
  const res = await fetch(apiUrl(`/api/reviews/${slug}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rating, text }),
  });
  const body = (await res.json().catch(() => ({}))) as Review & { error?: string };
  if (!res.ok) {
    return { error: body.error || "No se pudo enviar tu reseña.", status: res.status };
  }
  return { review: body, status: res.status };
}

async function markHelpful(slug: string, id: string): Promise<void> {
  await fetch(apiUrl(`/api/reviews/${slug}/${id}/helpful`), {
    method: "PATCH",
  });
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="rv-star-picker" role="group" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} estrella${star > 1 ? "s" : ""}`}
          aria-pressed={value === star}
          className={`rv-star${star <= (hover || value) ? " filled" : ""}`}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <Star size={18} weight={star <= (hover || value) ? "fill" : "regular"} />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review, slug }: { review: Review; slug: string }) {
  const [helped, setHelped] = useState(false);
  const [count, setCount] = useState(review.helpful);

  const handleHelpful = async () => {
    if (helped) return;
    setHelped(true);
    setCount((c) => c + 1);
    await markHelpful(slug, review.id).catch(() => undefined);
  };

  const date = new Date(review.date).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="rv-card">
      <header className="rv-card-header">
        <div className="rv-card-author">
          <span className="rv-avatar">{review.author.charAt(0).toUpperCase()}</span>
          <div>
            <p className="rv-author-name">{review.author}</p>
            <time className="rv-date" dateTime={review.date}>
              {date}
            </time>
          </div>
        </div>
        <StarRating score={review.rating * 20} />
      </header>
      <p className="rv-text">{review.text}</p>
      <footer className="rv-card-footer">
        <button
          type="button"
          className={`rv-helpful${helped ? " voted" : ""}`}
          onClick={() => void handleHelpful()}
          disabled={helped}
        >
          <ThumbsUp size={14} aria-hidden="true" /> Útil {count > 0 ? `(${count})` : ""}
        </button>
      </footer>
    </article>
  );
}

export function ReviewsSection({ slug }: { slug: string }) {
  const { user, token, status: authStatus } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [gateMessage, setGateMessage] = useState("");

  const textRef = useRef<HTMLTextAreaElement>(null);
  const [rating, setRating] = useState(0);

  const ownsGame = useMemo(
    () => Boolean(user?.steamGames?.some((game) => game.slug === slug)),
    [user?.steamGames, slug],
  );

  const canWrite = Boolean(token && user && ownsGame);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    fetchReviews(slug)
      .then((data) => {
        if (alive) {
          setReviews(data);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!canWrite) {
      setShowForm(false);
    }
  }, [canWrite]);

  const handleWriteClick = () => {
    setGateMessage("");
    if (authStatus === "loading") return;
    if (!user || !token) {
      setGateMessage("Inicia sesión para escribir una reseña.");
      setShowForm(false);
      return;
    }
    if (!ownsGame) {
      setGateMessage("Debes tener este juego en tu biblioteca para escribir una reseña.");
      setShowForm(false);
      return;
    }
    setShowForm((v) => !v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setFormError("Inicia sesión para escribir una reseña.");
      return;
    }
    if (!ownsGame) {
      setFormError("Debes poseer el juego para reseñarlo.");
      return;
    }
    const text = textRef.current?.value.trim() ?? "";
    if (rating === 0) {
      setFormError("Por favor selecciona una calificación.");
      return;
    }
    if (!text) {
      setFormError("Por favor escribe tu reseña.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      const result = await postReview(slug, token, rating, text);
      if (!result.review) {
        setFormError(result.error || "No se pudo enviar tu reseña. Inténtalo de nuevo.");
        return;
      }
      setReviews((prev) => [result.review!, ...prev]);
      setShowForm(false);
      setRating(0);
      if (textRef.current) textRef.current.value = "";
    } catch {
      setFormError("No se pudo enviar tu reseña. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const avg =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <section className="rv-section" aria-labelledby="rv-heading">
      <div className="rv-header">
        <div className="rv-header-left">
          <h2 id="rv-heading">Reseñas de la comunidad</h2>
          {reviews.length > 0 && (
            <p className="rv-summary">
              <span className="rv-avg">{avg.toFixed(1)}</span>
              <StarRating score={avg * 20} />
              <span className="rv-count">
                ({reviews.length} reseña{reviews.length !== 1 ? "s" : ""})
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          className="rv-write-btn"
          onClick={handleWriteClick}
          aria-expanded={showForm}
        >
          {showForm ? (
            "Cancelar"
          ) : (
            <>
              <PenLine size={16} aria-hidden />
              Escribir reseña
            </>
          )}
        </button>
      </div>

      {gateMessage ? (
        <p className="rv-gate" role="status">
          {gateMessage}{" "}
          {!user ? (
            <Link to="/auth">Iniciar sesión</Link>
          ) : !ownsGame ? (
            <Link to="/">Ver en la tienda</Link>
          ) : null}
        </p>
      ) : null}

      {showForm && canWrite ? (
        <form className="rv-form" onSubmit={(e) => void handleSubmit(e)}>
          <h3>Tu reseña</h3>
          <p className="rv-as">Publicarás como <strong>{user?.username}</strong></p>
          <div className="rv-label">
            Calificación
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <label className="rv-label">
            Reseña
            <textarea
              ref={textRef}
              className="rv-textarea"
              placeholder="¿Qué te pareció el juego?"
              rows={4}
              maxLength={1000}
              required
            />
          </label>
          {formError ? <p className="rv-form-error">{formError}</p> : null}
          <button type="submit" className="rv-submit" disabled={submitting}>
            {submitting ? "Enviando…" : "Publicar reseña"}
          </button>
        </form>
      ) : null}

      {status === "loading" && <p className="rv-loading">Cargando reseñas…</p>}
      {status === "error" && <p className="rv-loading">No se pudieron cargar las reseñas.</p>}
      {status === "ready" && reviews.length === 0 && !showForm && (
        <p className="rv-empty">Sé el primero en dejar tu reseña de este juego.</p>
      )}
      {status === "ready" && reviews.length > 0 && (
        <ul className="rv-list">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewCard review={r} slug={slug} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
