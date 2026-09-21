import { useEffect, useRef, useState } from "react";
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
  const res = await fetch(`http://127.0.0.1:8787/api/reviews/${slug}`);
  if (!res.ok) throw new Error("error");
  return res.json() as Promise<Review[]>;
}

async function postReview(
  slug: string,
  author: string,
  rating: number,
  text: string,
): Promise<Review> {
  const res = await fetch(`http://127.0.0.1:8787/api/reviews/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ author, rating, text }),
  });
  if (!res.ok) throw new Error("error");
  return res.json() as Promise<Review>;
}

async function markHelpful(slug: string, id: string): Promise<void> {
  await fetch(`http://127.0.0.1:8787/api/reviews/${slug}/${id}/helpful`, {
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
          ★
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
            <time className="rv-date" dateTime={review.date}>{date}</time>
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
          👍 Útil {count > 0 ? `(${count})` : ""}
        </button>
      </footer>
    </article>
  );
}

export function ReviewsSection({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const authorRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [rating, setRating] = useState(0);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const author = authorRef.current?.value.trim() ?? "";
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
      const review = await postReview(slug, author, rating, text);
      setReviews((prev) => [review, ...prev]);
      setShowForm(false);
      setRating(0);
      if (authorRef.current) authorRef.current.value = "";
      if (textRef.current) textRef.current.value = "";
    } catch {
      setFormError("No se pudo enviar tu reseña. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <section className="rv-section" aria-labelledby="rv-heading">
      <div className="rv-header">
        <div className="rv-header-left">
          <h2 id="rv-heading">Reseñas de la comunidad</h2>
          {reviews.length > 0 && (
            <p className="rv-summary">
              <span className="rv-avg">{avg.toFixed(1)}</span>
              <StarRating score={avg * 20} />
              <span className="rv-count">({reviews.length} reseña{reviews.length !== 1 ? "s" : ""})</span>
            </p>
          )}
        </div>
        <button
          type="button"
          className="rv-write-btn"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
        >
          {showForm ? "Cancelar" : "✍️ Escribir reseña"}
        </button>
      </div>

      {showForm && (
        <form className="rv-form" onSubmit={(e) => void handleSubmit(e)}>
          <h3>Tu reseña</h3>
          <label className="rv-label">
            Nombre (opcional)
            <input
              ref={authorRef}
              type="text"
              className="rv-input"
              placeholder="Anónimo"
              maxLength={60}
            />
          </label>
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
          {formError && <p className="rv-form-error">{formError}</p>}
          <button type="submit" className="rv-submit" disabled={submitting}>
            {submitting ? "Enviando…" : "Publicar reseña"}
          </button>
        </form>
      )}

      {status === "loading" && <p className="rv-loading">Cargando reseñas…</p>}
      {status === "error" && (
        <p className="rv-loading">No se pudieron cargar las reseñas.</p>
      )}
      {status === "ready" && reviews.length === 0 && !showForm && (
        <p className="rv-empty">
          Sé el primero en dejar tu reseña de este juego.
        </p>
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
