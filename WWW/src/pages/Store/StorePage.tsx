import { useCatalog } from "../../data/CatalogContext";
import { AdStrip } from "./AdStrip";
import { Download5 } from "./Download5";
import { Footer9 } from "./Footer9";
import { EventOffers } from "./EventOffers";
import { GameCatalog } from "./GameCatalog";
import { PageLoader } from "./LogoLoader";
import { SiteNav } from "./SiteNav";
import { useStoreEnter } from "./useStoreMotion";
import "./StorePage.css";

export function StorePage() {
  const { status, games } = useCatalog();
  const ready = status !== "loading";
  const root = useStoreEnter(ready);

  return (
    <div className="store" ref={root}>
      <SiteNav />
      <main aria-label="Tienda" aria-busy={status === "loading"}>
        {status === "loading" ? (
          <PageLoader label="Cargando tienda…" />
        ) : (
          <>
            <AdStrip />
            <EventOffers />
            <GameCatalog games={games.games} total={games.total} />
            <Download5 />
          </>
        )}
      </main>
      {status !== "loading" ? <Footer9 /> : null}
    </div>
  );
}
