import { Link } from "react-router-dom";
import { StoreArt } from "../../data/StoreArt";
import { formatMxn, useCart } from "../../data/CartContext";
import { Footer9 } from "../Store/Footer9";
import { SiteNav } from "../Store/SiteNav";
import "./CartPage.css";

export function CartPage() {
  const { items, remove } = useCart();
  const total = items.reduce((sum, item) => sum + item.priceValue, 0);

  return (
    <div className="cart-page">
      <SiteNav />
      <main className="cart-main">
        <h1>Carrito</h1>
        {items.length === 0 ? (
          <p className="cart-empty">
            Aún no hay juegos en el carrito. <Link to="/juegos">Ver la tienda</Link>
          </p>
        ) : (
          <>
            <p className="cart-lead">
              {items.length} {items.length === 1 ? "juego" : "juegos"}
            </p>
            <ul className="cart-list">
              {items.map((item) => (
                <li key={item.slug} className="cart-row">
                  <StoreArt className="cart-cover" src={item.cover} alt="" />
                  <strong>{item.name}</strong>
                  <span className="cart-price">{item.price}</span>
                  <button type="button" onClick={() => remove(item.slug)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
            <div className="cart-total">
              <strong>{formatMxn(total)}</strong>
              <Link className="cart-pay" to="/pago">
                Pagar
              </Link>
            </div>
          </>
        )}
      </main>
      <Footer9 />
    </div>
  );
}
