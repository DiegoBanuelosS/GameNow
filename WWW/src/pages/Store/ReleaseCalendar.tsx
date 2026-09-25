import { useEffect, useMemo, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Link } from "react-router-dom";
import { CalendarOff, CalendarX2, Gamepad2, Library, LoaderCircle, type LucideIcon } from "lucide-react";

gsap.registerPlugin(useGSAP, ScrollTrigger);
import { apiUrl } from "../../data/api";
import { useAuth } from "../../data/AuthContext";
import { learnTaste, mostPlayedThisWeek, predictScore } from "../../data/tasteModel";
import { StoreArt } from "../../data/StoreArt";
import "./ReleaseCalendar.css";

type SpecRow = { label: string; min: string; max: string };

type ReleaseAsset = {
  type: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
};

type ReleaseTitle = {
  appId: string;
  name: string;
  studio: string;
  cover: string;
  price: string;
  href: string;
  description: string;
  genres?: string[];
  assets: ReleaseAsset[];
  specs: SpecRow[];
};

type SimilarGame = {
  appId: string;
  name: string;
  studio?: string;
  cover: string;
  price: string;
  href: string;
};

type ReleaseDay = {
  date: string;
  label: string;
  shortDate: string;
  releases: ReleaseTitle[];
};

export function ReleaseCalendar() {
  const { user } = useAuth();
  const [days, setDays] = useState<ReleaseDay[] | null>(null);
  const [error, setError] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [similar, setSimilar] = useState<SimilarGame[] | null>(null);
  const [similarError, setSimilarError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(apiUrl("/api/releases"), { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ days: ReleaseDay[] }>;
      })
      .then((payload) => {
        if (!active) return;
        setDays(payload.days);
        const first = payload.days.findIndex((day) => day.releases.length > 0);
        const index = first < 0 ? 0 : first;
        setDayIndex(index);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const day = days?.[dayIndex];

  const taste = useMemo(() => learnTaste(user?.steamGames ?? []), [user?.steamGames]);

  const suggestions = useMemo(() => {
    if (!days || taste.samples === 0) return [];
    const ownedIds = new Set((user?.steamGames ?? []).map((game) => game.steamAppId).filter(Boolean));
    const ownedNames = new Set((user?.steamGames ?? []).map((game) => game.name.toLowerCase()));
    return days
      .flatMap((item) => item.releases)
      .filter((title) => !ownedIds.has(title.appId) && !ownedNames.has(title.name.toLowerCase()))
      .map((title) => ({ title, score: predictScore(title.genres ?? [], taste.weights) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.title);
  }, [days, taste, user?.steamGames]);

  const weekGame = useMemo(() => mostPlayedThisWeek(user?.steamGames ?? []), [user?.steamGames]);

  useEffect(() => {
    const appId = weekGame?.steamAppId;
    if (!appId) {
      setSimilar(null);
      setSimilarError(false);
      return;
    }
    let active = true;
    setSimilar(null);
    setSimilarError(false);
    fetch(apiUrl(`/api/similar/${appId}?genre=${encodeURIComponent(weekGame.genre || "")}`), { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ games: SimilarGame[] }>;
      })
      .then((payload) => {
        if (active) setSimilar(payload.games);
      })
      .catch(() => {
        if (active) setSimilarError(true);
      });
    return () => {
      active = false;
    };
  }, [weekGame?.steamAppId, weekGame?.genre]);

  const because = useMemo(() => {
    if (!similar) return [];
    const ownedIds = new Set((user?.steamGames ?? []).map((game) => game.steamAppId).filter(Boolean));
    const ownedNames = new Set((user?.steamGames ?? []).map((game) => game.name.toLowerCase()));
    const shown = new Set(suggestions.map((title) => title.appId));
    return similar
      .filter(
        (title) =>
          !ownedIds.has(title.appId) &&
          !ownedNames.has(title.name.toLowerCase()) &&
          !shown.has(title.appId),
      )
      .slice(0, 4);
  }, [similar, suggestions, user?.steamGames]);

  useGSAP(() => {
    if (!days || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from(".release-days", {
      y: 24,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".release-calendar",
        start: "top 86%",
        toggleActions: "play none none none",
      },
    });
    gsap.from(".because-you-played .release-card", {
      y: 32,
      opacity: 0,
      duration: 0.55,
      stagger: 0.08,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".because-you-played",
        start: "top 86%",
        toggleActions: "play none none none",
      },
    });
    gsap.from(".you-may-like .release-card", {
      y: 32,
      opacity: 0,
      duration: 0.55,
      stagger: 0.08,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".you-may-like",
        start: "top 86%",
        toggleActions: "play none none none",
      },
    });
    gsap.from(".release-calendar .release-card", {
      y: 32,
      opacity: 0,
      duration: 0.55,
      stagger: 0.08,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".release-calendar",
        start: "top 86%",
        toggleActions: "play none none none",
      },
    });
  }, [days]);

  return (
    <>
    <section className="release-calendar" id="lanzamientos" aria-labelledby="release-calendar-title">
      <h2 id="release-calendar-title">Calendario de lanzamientos</h2>
      {error ? <ReleaseNotice icon={CalendarX2}>No se pudo cargar el calendario.</ReleaseNotice> : null}
      {!days && !error ? <ReleaseNotice icon={LoaderCircle}>Cargando lanzamientos…</ReleaseNotice> : null}
      {days ? (
        <>
          <div className="release-days" role="tablist" aria-label="Días">
            {days.map((item, index) => (
              <button
                key={item.date}
                type="button"
                role="tab"
                aria-selected={index === dayIndex}
                className={index === dayIndex ? "is-active" : undefined}
                onClick={() => setDayIndex(index)}
              >
                <span>{item.label}</span>
                <small>{item.shortDate}</small>
              </button>
            ))}
          </div>

          {day && day.releases.length === 0 ? (
            <ReleaseNotice icon={CalendarOff}>Sin lanzamientos este día.</ReleaseNotice>
          ) : (
            <ul className="release-list">
              {day?.releases.map((title) => (
                <li key={title.appId}>
                  <Link className="release-card" to={`/lanzamiento/${title.appId}`}>
                    <StoreArt src={title.cover} alt="" />
                    <span className="release-card-copy">
                      <strong>{title.name}</strong>
                      {title.studio ? <em>{title.studio}</em> : null}
                      {title.price ? <span>{title.price}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
    <section className="you-may-like" aria-labelledby="you-may-like-title">
      <h2 id="you-may-like-title">Te podría gustar</h2>
      {suggestions.length ? (
        <ul className="release-list">
          {suggestions.map((title) => (
            <li key={title.appId}>
              <Link className="release-card" to={`/lanzamiento/${title.appId}`}>
                <StoreArt src={title.cover} alt="" />
                <span className="release-card-copy">
                  <strong>{title.name}</strong>
                  {title.studio ? <em>{title.studio}</em> : null}
                  {title.price ? <span>{title.price}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ReleaseNotice icon={Library}>
          Cuando tengas juegos en tu biblioteca, esta fila se arma con las categorías que más juegas.
        </ReleaseNotice>
      )}
    </section>
    <section className="because-you-played" aria-labelledby="because-you-played-title">
      <h2 id="because-you-played-title">
        {weekGame ? `Por qué jugaste ${weekGame.name}` : "Por qué jugaste"}
      </h2>
      {because.length ? (
        <ul className="release-list">
          {because.map((title) => (
            <li key={title.appId}>
              <Link className="release-card" to={title.href.startsWith("/") ? title.href : `/lanzamiento/${title.appId}`}>
                <StoreArt src={title.cover} alt="" />
                <span className="release-card-copy">
                  <strong>{title.name}</strong>
                  {title.studio ? <em>{title.studio}</em> : null}
                  {title.price ? <span>{title.price}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ReleaseNotice icon={weekGame && similar === null && !similarError ? LoaderCircle : Gamepad2}>
          {similarError
            ? "No se pudieron cargar juegos parecidos."
            : weekGame && similar === null
              ? "Buscando juegos parecidos…"
              : weekGame
                ? `Nada parecido a ${weekGame.name}.`
                : "No jugaste nada esta semana."}
        </ReleaseNotice>
      )}
    </section>
    </>
  );
}

function ReleaseNotice({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="release-slot" role="status">
      <Icon size={28} strokeWidth={1.5} aria-hidden />
      <p>{children}</p>
    </div>
  );
}
