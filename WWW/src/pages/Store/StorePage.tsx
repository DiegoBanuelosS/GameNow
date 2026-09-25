import { useCatalog } from "../../data/CatalogContext";
import { useDesktopApp } from "../../data/useDesktopApp";
import { AdStrip } from "./AdStrip";
import { ConnectionBanner } from "./ConnectionBanner";
import { Download5 } from "./Download5";
import { Footer9 } from "./Footer9";
import { EventOffers } from "./EventOffers";
import { ReleaseCalendar } from "./ReleaseCalendar";
import { GameCatalog } from "./GameCatalog";
import { PageLoader } from "./LogoLoader";
import { SiteNav } from "./SiteNav";
import { useStoreEnter } from "./useStoreMotion";
import "./StorePage.css";

export function StorePage() {
  const { status, games } = useCatalog();
  const ready = status !== "loading";
  const root = useStoreEnter(ready);
  const isApp = useDesktopApp();

  return (
    <div className="store" ref={root}>
      <SiteNav />
      <main aria-label="Tienda" aria-busy={status === "loading"}>
        {status === "loading" ? (
          <PageLoader label="Cargando tienda…" />
        ) : status === "error" ? (
          <ConnectionBanner
            title="Tuvimos un problema al conectarte"
            detail="La tienda no respondió. Espera un momento y vuelve a cargar la página."
          />
        ) : (
          <>
            <AdStrip />
            <EventOffers />
            <ReleaseCalendar />
            <GameCatalog games={games.games} total={games.total} />
            {!isApp && <Download5 />}
          </>
        )}
      </main>
      {status !== "loading" ? <Footer9 /> : null}
    </div>
  );
}
