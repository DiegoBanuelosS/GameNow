import { Footer9 } from "../Store/Footer9";
import { SiteNav } from "../Store/SiteNav";
import "../Store/StorePage.css";

export function CartPage() {
  return (
    <div className="store">
      <SiteNav />
      <main className="store-main">
        <h1>Carrito</h1>
        <p>Aún no hay juegos en el carrito.</p>
      </main>
      <Footer9 />
    </div>
  );
}
