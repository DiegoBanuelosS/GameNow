import type { GameFilterState, GameTabId } from "../../data/gameFilters";
import { GAME_COLLECTIONS } from "../../data/gameFilters";
import { formatMxn } from "../../data/money";
import { DualRangeSlider } from "./RangeSlider";
import { StarFilter } from "./StarRating";

export function GamesSidebar({
  filters,
  ceiling,
  onChange,
}: {
  filters: GameFilterState;
  ceiling: number;
  onChange: (next: GameFilterState) => void;
}) {
  function setCollection(collection: GameTabId) {
    onChange({
      ...filters,
      collection: filters.collection === collection ? "todos" : collection,
    });
  }

  return (
    <aside className="games-sidebar" aria-label="Filtros de juegos">
      <fieldset>
        <legend>Rango de precios</legend>
        <DualRangeSlider
          label="Precio"
          min={0}
          max={ceiling}
          minValue={Math.min(filters.minPrice, filters.maxPrice)}
          maxValue={filters.maxPrice}
          minText={formatMxn(filters.minPrice, true)}
          maxText={filters.maxPrice >= ceiling ? "y más" : formatMxn(filters.maxPrice, true)}
          onChange={(minPrice, maxPrice) => onChange({ ...filters, minPrice, maxPrice })}
        />
      </fieldset>

      <fieldset>
        <legend>Valoración</legend>
        <StarFilter
          value={filters.minMetacritic}
          onChange={(minMetacritic) => onChange({ ...filters, minMetacritic })}
        />
      </fieldset>

      <div className="games-sidebar-collections" role="group" aria-label="Colección">
        {GAME_COLLECTIONS.map((item) => {
          const pressed = filters.collection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setCollection(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
