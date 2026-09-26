import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { StoreArt } from "../../data/StoreArt";
import { formatMxn, useCart, type CartItem } from "../../data/CartContext";
import { useAuth } from "../../data/AuthContext";
import { useDownloads } from "../../data/DownloadsContext";
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

type DemoAddress = {
  id: string;
  label: string;
  address: string;
  city: string;
  postal: string;
};

/** Direcciones de prueba (solo frontend) */
const DEMO_ADDRESSES: DemoAddress[] = [
  {
    id: "cdmx",
    label: "CDMX",
    address: "Av. Insurgentes Sur 1458",
    city: "Ciudad de México",
    postal: "03100",
  },
  {
    id: "gdl",
    label: "Guadalajara",
    address: "Calle Morelos 220",
    city: "Guadalajara",
    postal: "44100",
  },
  {
    id: "mty",
    label: "Monterrey",
    address: "Av. Constitución 500",
    city: "Monterrey",
    postal: "64000",
  },
];

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
  const { token, user, purchaseGames } = useAuth();
  const { startDownload } = useDownloads();
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
  const [downloadNote, setDownloadNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [paidWith, setPaidWith] = useState<"wallet" | "card" | "">("");
  const [saveCard, setSaveCard] = useState(true);

  const games = order ?? items;
  const total = games.reduce((sum, item) => sum + item.priceValue, 0);
  const balance = user?.balance || 0;
  const walletCovers = balance + 0.001 >= total && total > 0;
  const savedLast4 = /^\d{4}$/.test(user?.cardLast4 || "") ? user!.cardLast4! : "";

  const finish = async (payment: { method: "wallet" | "card"; cardLast4?: string }) => {
    if (!token) {
      setError("Inicia sesión para completar el pago.");
      return;
    }
    setPaying(true);
    const saved = await purchaseGames(
      items.map((item) => ({ slug: item.slug, price: item.priceValue })),
      payment,
    );
    setPaying(false);
    if (!saved.ok) {
      setError(saved.error || "No se pudo agregar el juego a la biblioteca.");
      return;
    }
    setError("");
    setPaidWith(payment.method);
    setOrder(items);
    setCard("");
    setCvv("");
    setExpiry("");
    clear();
  };

  const fillDemoAddress = (demo: DemoAddress) => {
    setAddress(demo.address);
    setCity(demo.city);
    setPostal(demo.postal);
    setError("");
  };

  const payWithWallet = () => {
    if (items.length === 0 || paying) return;
    if (!walletCovers) {
      setError(`Tu saldo es ${formatMxn(balance)} y este pedido cuesta ${formatMxn(total)}.`);
      return;
    }
    void finish({ method: "wallet" });
  };

  const payWithSavedCard = () => {
    if (items.length === 0 || paying || !savedLast4) return;
    void finish({ method: "card", cardLast4: savedLast4 });
  };

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
    const last4 = card.slice(-4);
    await finish({ method: "card", cardLast4: saveCard ? last4 : undefined });
  };

  const beginDownload = async (item: CartItem) => {
    setSelected(item.slug);
    const result = await startDownload({ slug: item.slug, name: item.name, cover: item.cover });
    setDownloadNote(result.ok ? "La descarga empezó. La ves en la barra de abajo." : result.error || "No se pudo descargar.");
  };

  const downloadContent = async () => {
    if (!order?.length) return;
    if (order.length === 1) {
      await beginDownload(order[0]);
      return;
    }
    const item = order.find((game) => game.slug === selected);
    if (!item) {
      setPicking(true);
      setDownloadNote("Elige un juego.");
      return;
    }
    await beginDownload(item);
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
            <p>
              {paidWith === "wallet"
                ? "Se descontó de tu cartera."
                : saveCard || savedLast4
                  ? "Tu pedido quedó registrado. Guardamos la terminación de tu tarjeta para la próxima compra."
                  : "Tu pedido quedó registrado."}
            </p>
            <button type="button" className="pay-download" onClick={() => void downloadContent()}>
              Descargar tu contenido
            </button>
            {downloadNote ? <p className="pay-note">{downloadNote}</p> : null}
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
                        onClick={() => void beginDownload(item)}
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
                <div className="pay-methods">
                  {balance > 0 ? (
                    <div className="pay-wallet-box">
                      <p>Saldo en tu cartera: {formatMxn(balance)}</p>
                      <button type="button" className="pay-wallet" disabled={!walletCovers || paying} onClick={payWithWallet}>
                        Pagar con tu saldo
                      </button>
                      {walletCovers ? null : <p className="pay-note">Tu saldo no alcanza para este pedido.</p>}
                    </div>
                  ) : null}

                  <div className="pay-saved" aria-label="Tarjetas guardadas">
                    <p className="pay-saved-title">Tarjeta guardada</p>
                    {savedLast4 ? (
                      <button
                        type="button"
                        className="pay-saved-card is-primary"
                        disabled={paying}
                        onClick={payWithSavedCard}
                      >
                        <span>
                          <strong>Pagar con la última tarjeta</strong>
                          <small>Terminación {savedLast4}</small>
                        </span>
                        <CardMark brand="" />
                      </button>
                    ) : (
                      <p className="pay-note">Aún no tienes una tarjeta guardada. Llena el formulario para guardar una.</p>
                    )}
                    <p className="pay-saved-title">Direcciones X</p>
                    <div className="pay-saved-row">
                      {DEMO_ADDRESSES.map((demo) => (
                        <button
                          key={demo.id}
                          type="button"
                          className="pay-saved-chip"
                          disabled={paying}
                          onClick={() => fillDemoAddress(demo)}
                        >
                          {demo.label}
                        </button>
                      ))}
                    </div>
                  </div>

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
                    <label className="pay-save-toggle">
                      <input type="checkbox" checked={saveCard} onChange={(event) => setSaveCard(event.target.checked)} />
                      <span>Guardar esta tarjeta para la próxima compra</span>
                    </label>
                    {error ? <p className="pay-error">{error}</p> : <p className="pay-note">Solo guardamos la terminación (últimos 4 dígitos).</p>}
                    <button type="submit" disabled={paying}>
                      Pagar {formatMxn(total)}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <Footer9 />
    </div>
  );
}
