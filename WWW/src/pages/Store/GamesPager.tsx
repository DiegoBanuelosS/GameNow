const WINDOW = 2;

function pagesAround(current: number, total: number) {
  const items: Array<number | "gap"> = [];
  for (let page = 1; page <= total; page += 1) {
    const edge = page === 1 || page === total;
    const near = Math.abs(page - current) <= WINDOW;
    if (edge || near) {
      items.push(page);
    } else if (items[items.length - 1] !== "gap") {
      items.push("gap");
    }
  }
  return items;
}

export function GamesPager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav className="games-pager" aria-label="Páginas del catálogo">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </button>
      <ol>
        {pagesAround(page, pageCount).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden>
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPage(item)}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ol>
      <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        Siguiente
      </button>
    </nav>
  );
}
