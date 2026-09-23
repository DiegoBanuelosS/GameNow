import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { StoreArt } from "../../data/StoreArt";
import { formatMxn, useCart, type CartItem } from "../../data/CartContext";
import { useAuth } from "../../data/AuthContext";
import { Footer9 } from "../Store/Footer9";
import { SiteNav } from "../Store/SiteNav";
import "./CartPage.css";

function digits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

function cardLabel(value: string) {
  return value.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function cardBrand(value: string) {
  if (/^4/.test(value)) return "visa";
  if (/^3[47]/.test(value)) return "amex";
  if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/.test(value)) return "mastercard";
  return "";
}

function CardMark({ brand }: { brand: string }) {
  if (brand === "visa") {
    return (
      <svg className="pay-card-mark" width="36" height="16" viewBox="0 0 36 16" aria-hidden="true">
        <text x="0" y="13" fill="#1a1f71" fontSize="13" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic">
          VISA
        </text>
      </svg>
    );
  }
  if (brand === "mastercard") {
    return (
      <svg className="pay-card-mark" width="36" height="22" viewBox="0 0 36 22" aria-hidden="true">
        <circle cx="13" cy="11" r="8" fill="#eb001b" />
        <circle cx="23" cy="11" r="8" fill="#f79e1b" />
      </svg>
    );
  }
  if (brand === "amex") {
    return (
      <svg className="pay-card-mark" width="36" height="16" viewBox="0 0 36 16" aria-hidden="true">
        <rect width="36" height="16" rx="2" fill="#2e77bc" />
        <text x="18" y="11" fill="#fff" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="700" textAnchor="middle">
          AMEX
        </text>
      </svg>
    );
  }
  return (
    <svg className="pay-card-mark" width="28" height="18" viewBox="0 0 28 18" aria-hidden="true">
      <rect x="0.5" y="0.5" width="27" height="17" rx="2" fill="none" stroke="#a39c93" />
      <rect x="0" y="4" width="28" height="3" fill="#a39c93" />
    </svg>
  );
}

export function PayPage() {
  const { items, clear } = useCart();
  const { token, purchaseGames } = useAuth();
  const [order, setOrder] = useState<CartItem[] | null>(null);
  const [name, setName] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [error, setError] = useState("");
  const [showCvv, setShowCvv] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState("");

  const games = order ?? items;
  const total = games.reduce((sum, item) => sum + item.priceValue, 0);

  const pay = async (event: FormEvent) => {
    event.preventDefault();
    if (items.length === 0) return;
    const month = Number(expiry.slice(0, 2));
    const year = Number(expiry.slice(3, 5));
    if (name.trim().length < 3) {
      setError("Escribe el nombre de la tarjeta.");
      return;
    }
    if (card.length < 13) {
      setError("Revisa el número de tarjeta.");
      return;
    }
    if (month < 1 || month > 12 || expiry.length < 5 || Number.isNaN(year)) {
      setError("Revisa la fecha de vencimiento.");
      return;
    }
    if (cvv.length < 3) {
      setError("Revisa el CVV.");
      return;
    }
    if (!address.trim() || !city.trim() || postal.length < 4) {
      setError("Completa la dirección.");
      return;
    }
    const slugs = items.map((item) => item.slug);
    if (token) {
      const saved = await purchaseGames(slugs);
      if (!saved.ok) {
        setError(saved.error || "No se pudo agregar el juego a la biblioteca.");
        return;
      }
    }
    setError("");
    setOrder(items);
    setCard("");
    setCvv("");
    setExpiry("");
    clear();
  };

  return (
    <div className="cart-page">
      <SiteNav />
      <main className="cart-main">
        {order ? (
          <section className="pay-success" aria-label="Pago listo">
            <span className="pay-success-mark">
              <Check size={28} aria-hidden="true" />
            </span>
            <h1>Pago listo</h1>
            <p>Tu pedido quedó registrado. Los datos de la tarjeta no se guardan.</p>
            <button type="button" className="pay-download" onClick={() => setPicking(true)}>
              Descargar ahora
            </button>
            {picking ? (
              <ul className="pay-pick" aria-label="Elige qué descargar">
                {order.map((item) => {
                  const on = selected === item.slug;
                  return (
                    <li key={item.slug}>
                      <button
                        type="button"
                        className={on ? "is-selected" : ""}
                        aria-pressed={on}
                        onClick={() => setSelected(item.slug)}
                      >
                        <span className="pay-pick-art">
                          <StoreArt className="cart-cover" src={item.cover} alt="" />
                          {on ? (
                            <span className="pay-pick-check">
                              <Check size={14} aria-hidden="true" />
                            </span>
                          ) : null}
                        </span>
                        <strong>{item.name}</strong>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        ) : (
          <>
        <h1>Pago</h1>
        <p className="cart-lead">
          <Link className="cart-back" to="/cart">
            Volver al carrito
          </Link>
        </p>
        {games.length === 0 ? (
          <p className="cart-empty">
            No hay juegos para pagar. <Link to="/juegos">Ver la tienda</Link>
          </p>
        ) : (
          <div className="pay-layout">
            <section aria-label="Juegos del pedido">
              <ul className="pay-grid">
                {games.map((item) => (
                  <li key={item.slug}>
                    <StoreArt className="cart-cover" src={item.cover} alt="" />
                    <strong>{item.name}</strong>
                    <small>{item.price}</small>
                  </li>
                ))}
              </ul>
              <p className="cart-lead">Total {formatMxn(total)}</p>
            </section>
            <form className="pay-form" onSubmit={pay}>
                <label>
                  Nombre en la tarjeta
                  <input autoComplete="cc-name" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label>
                  Tarjeta
                  <span className="pay-card-field">
                    <input
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={cardLabel(card)}
                      onChange={(event) => setCard(digits(event.target.value, 19))}
                    />
                    <CardMark brand={cardBrand(card)} />
                  </span>
                </label>
                <div className="pay-row">
                  <label>
                    Vencimiento
                    <input
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/AA"
                      value={expiry}
                      onChange={(event) => {
                        const next = digits(event.target.value, 4);
                        setExpiry(next.length > 2 ? `${next.slice(0, 2)}/${next.slice(2)}` : next);
                      }}
                    />
                  </label>
                  <label>
                    CVV
                    <span className="pay-cvv-field">
                      <input
                        type={showCvv ? "text" : "password"}
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        value={cvv}
                        onChange={(event) => setCvv(digits(event.target.value, 4))}
                      />
                      <button type="button" onClick={() => setShowCvv((open) => !open)}>
                        {showCvv ? "Ocultar" : "Mostrar"}
                      </button>
                    </span>
                  </label>
                </div>
                <label>
                  Dirección
                  <input autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} />
                </label>
                <label>
                  Ciudad
                  <input autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} />
                </label>
                <label>
                  Código postal
                  <input
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={postal}
                    onChange={(event) => setPostal(digits(event.target.value, 5))}
                  />
                </label>
                {error ? <p className="pay-error">{error}</p> : <p className="pay-note">La tarjeta solo se usa en esta pantalla.</p>}
                <button type="submit">Pagar {formatMxn(total)}</button>
              </form>
          </div>
        )}
          </>
        )}
      </main>
      <Footer9 />
    </div>
  );
}
