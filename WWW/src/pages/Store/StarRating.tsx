import { Star } from "@phosphor-icons/react";
import "./StarRating.css";

export function scoreToStars(score: number | null) {
  if (!score) {
    return 0;
  }
  return Math.round((score / 100) * 5);
}

export function StarRating({
  score,
  size = 18,
}: {
  score: number | null;
  size?: number;
}) {
  const filled = scoreToStars(score);
  const label = filled ? `${filled} de 5` : "Sin valoración";

  return (
    <span className="star-rating" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => {
        const on = index < filled;
        return (
          <Star
            key={index}
            size={size}
            weight={on ? "fill" : "regular"}
            className={on ? "is-on" : undefined}
            aria-hidden
          />
        );
      })}
    </span>
  );
}

export function StarFilter({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="star-filter">
      <p>{value ? `Desde ${value} estrellas` : "Cualquier valoración"}</p>
      <div role="group" aria-label="Valoración mínima">
        {Array.from({ length: 5 }, (_, index) => {
          const stars = index + 1;
          const pressed = value === stars;
          return (
            <button
              key={stars}
              type="button"
              aria-pressed={pressed}
              aria-label={`${stars} estrellas`}
              onClick={() => onChange(value === stars ? 0 : stars)}
            >
              <Star size={22} weight={value >= stars ? "fill" : "regular"} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
