import { useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { StoreArt } from "../../data/StoreArt";
import type { CatalogGame } from "../../data/catalog";
import { StarRating } from "./StarRating";

gsap.registerPlugin(useGSAP);

export function GamesTable({
  games,
  caption,
  layoutKey,
}: {
  games: CatalogGame[];
  caption: string;
  layoutKey?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const rows = wrapRef.current?.querySelectorAll("tbody tr");
      if (!rows?.length || rows.length > 24 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
      gsap.fromTo(
        rows,
        { y: 18, opacity: 0, scale: 0.985 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.42,
          stagger: 0.045,
          ease: "power3.out",
          overwrite: true,
        },
      );
    },
    { scope: wrapRef, dependencies: [layoutKey ?? games.map((game) => game.slug).join(",")] },
  );

  return (
    <div className="games-table-wrap" ref={wrapRef}>
      <table className="games-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Portada</th>
            <th scope="col">Juego</th>
            <th scope="col">Valoración</th>
            <th scope="col">Precio</th>
          </tr>
        </thead>
        <tbody>
          {games.length ? (
            games.map((game) => (
              <tr key={game.slug} className="games-row">
                <td>
                  <StoreArt
                    className="games-table-cover"
                    src={game.cover}
                    srcSet={game.coverSrcSet}
                    sizes="108px"
                    fallback={game.coverFallback}
                    alt=""
                    width={108}
                    height={162}
                  />
                </td>
                <td>
                  <Link to={game.href}>{game.name}</Link>
                </td>
                <td>
                  <StarRating score={game.metacritic} />
                </td>
                <td>
                  {game.was ? <s>{game.was}</s> : null} <span>{game.price}</span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4}>No hay juegos que coincidan con esos filtros.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
