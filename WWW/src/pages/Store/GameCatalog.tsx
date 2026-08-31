import { Link } from "react-router-dom";
import type { CatalogGame } from "../../data/catalog";
import { GamesTable } from "./GamesTable";
import "./GameTables.css";

const PREVIEW = 6;

export function GameCatalog({ games, total }: { games: CatalogGame[]; total: number }) {
  const preview = games.slice(0, PREVIEW);

  return (
    <section className="games-tables" aria-labelledby="games-tables-title">
      <div className="games-tables-head">
        <div>
          <h2 id="games-tables-title">Nuestros Juegos</h2>
          <p className="games-tables-lead">
            {preview.length} de {total} títulos
          </p>
        </div>
        <Link className="games-more" to="/juegos">
          Ver más
        </Link>
      </div>

      <GamesTable games={preview} caption="Vista previa" layoutKey="preview" />
    </section>
  );
}
