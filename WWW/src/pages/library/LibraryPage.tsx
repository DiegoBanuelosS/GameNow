import { Footer9 } from "../Store/Footer9";
import { SiteNav } from "../Store/SiteNav";
import "../Store/StorePage.css";

export function LibraryPage() {
  return (
    <div className="store">
      <SiteNav />
      <main className="store-main">
        <h1>Mi biblioteca</h1>
        <p>Aquí verás los juegos que tengas. Aún no hay títulos guardados.</p>
      </main>
      <Footer9 />
    </div>
  );
}
