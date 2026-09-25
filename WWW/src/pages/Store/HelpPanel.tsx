import { FormEvent, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { X } from "../../components/Icons";
import { apiUrl } from "../../data/api";
import { useAuth } from "../../data/AuthContext";
import { useAppPanels } from "../../data/AppPanelsContext";
import "./AppPanels.css";

const GLOBAL_FAQS = [
  {
    q: "¿Cómo vinculo mi cuenta de Steam?",
    a: "Entra a tu perfil o biblioteca y usa «Vincular Steam». Confirma el inicio de sesión en Steam con tu perfil público de juegos visible.",
  },
  {
    q: "¿Mis partidas se sincronizan automáticamente?",
    a: "Sí. Con la sincronización en la nube activa, GameNow guarda horas, favoritos y cambios de tu biblioteca en tu cuenta.",
  },
  {
    q: "¿Puedo vender un juego?",
    a: "Solo los títulos comprados en GameNow. Abre el juego en tu biblioteca, entra a Ayuda o Configurar y elige Vender.",
  },
  {
    q: "¿Cómo contacto soporte?",
    a: "Usa «¿Necesitas más ayuda? Contáctanos» en este centro. Te pediremos un asunto y un mensaje.",
  },
];

const GAME_FAQS = [
  {
    q: "¿El juego no descarga o se queda en cola?",
    a: "Revisa tu conexión y la barra de descargas. Si sigue fallando, reinicia GameNow e inténtalo de nuevo.",
  },
  {
    q: "¿Puedo quitar este juego de mi cuenta?",
    a: "Sí. Usa «Eliminar juego de mi cuenta» a la derecha. Si es un título de Steam, solo desaparece de la vista GameNow.",
  },
  {
    q: "¿Cómo vendo este juego?",
    a: "Solo aplica a compras hechas en GameNow. El reembolso se calcula según horas jugadas y mercado.",
  },
];

export function HelpPanel() {
  const { panel, helpGame, closePanels } = useAppPanels();
  const { token, updateLibraryGame } = useAuth();
  const open = panel === "help";
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const confirmRemoveRef = useRef(false);
  confirmRemoveRef.current = confirmRemove;

  useEffect(() => {
    if (!open) return;
    setOpenFaq(0);
    setContactOpen(false);
    setSent(false);
    setSubject(helpGame ? `Ayuda: ${helpGame.name}` : "");
    setMessage("");
    setError("");
    setBusy("");
    setActionNotice("");
    setConfirmRemove(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmRemoveRef.current) {
        setConfirmRemove(false);
        return;
      }
      closePanels();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, helpGame, closePanels]);

  if (!open) return null;

  const faqs = helpGame ? GAME_FAQS : GLOBAL_FAQS;

  const submitContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("Inicia sesión para enviar el mensaje.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/api/support"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          gameSlug: helpGame?.slug || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "No se pudo enviar el mensaje.");
        setSending(false);
        return;
      }
      setSent(true);
      setContactOpen(false);
    } catch {
      setError("No se pudo enviar el mensaje.");
    }
    setSending(false);
  };

  const removeGame = async () => {
    if (!helpGame) return;
    if (!token) {
      setActionNotice("Inicia sesión para eliminar el juego.");
      setConfirmRemove(false);
      return;
    }
    setBusy("remove");
    setActionNotice("");
    const result = await updateLibraryGame(helpGame.slug, { remove: true });
    setBusy("");
    setConfirmRemove(false);
    if (!result.ok) {
      setActionNotice(result.error || "No se pudo eliminar el juego.");
      return;
    }
    closePanels();
  };

  const sellGame = async (payout: "wallet" | "card") => {
    if (!helpGame) return;
    setBusy(payout);
    setActionNotice("");
    const result = await updateLibraryGame(helpGame.slug, { sell: true, payout });
    setBusy("");
    if (!result.ok) {
      setActionNotice(result.error || "No se pudo vender el juego.");
      return;
    }
    setActionNotice(payout === "wallet" ? "Venta completada. El saldo fue a tu cartera." : "Venta registrada. El pago a tarjeta queda pendiente.");
  };

  return (
    <div className="app-panel" role="dialog" aria-modal="true" aria-labelledby="help-panel-title">
      <div className="app-panel-shell">
        <header className="app-panel-head">
          <div>
            <h2 id="help-panel-title">Centro de ayuda</h2>
            <p>{helpGame ? `Soporte para ${helpGame.name}` : "Preguntas frecuentes y contacto"}</p>
          </div>
          <button type="button" className="app-panel-close" onClick={closePanels} aria-label="Cerrar">
            <X size={18} />
            <span>Cerrar</span>
          </button>
        </header>

        <div className={`app-panel-body help-panel-body${helpGame ? " is-game" : ""}`}>
          <section className="help-main-col" aria-label="Preguntas frecuentes">
            {helpGame ? <h3 className="help-game-title">{helpGame.name}</h3> : null}

            <div className="help-faq-list">
              {faqs.map((item, index) => {
                const expanded = openFaq === index;
                return (
                  <div key={item.q} className={`help-faq-item${expanded ? " is-open" : ""}`}>
                    <button
                      type="button"
                      className="help-faq-q"
                      aria-expanded={expanded}
                      onClick={() => setOpenFaq(expanded ? null : index)}
                    >
                      {item.q}
                    </button>
                    {expanded ? <p className="help-faq-a">{item.a}</p> : null}
                  </div>
                );
              })}
            </div>

            {!helpGame ? (
              <div className="help-contact-block">
                {sent ? (
                  <div className="help-sent" role="status">
                    <Check size={22} aria-hidden="true" />
                    <div>
                      <strong>Mensaje enviado</strong>
                      <span>Recibimos tu consulta. Te responderemos pronto.</span>
                    </div>
                  </div>
                ) : contactOpen ? (
                  <form className="help-contact-form" onSubmit={submitContact}>
                    <h3>Contáctanos</h3>
                    <label>
                      Asunto
                      <input
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        required
                        maxLength={160}
                        placeholder="¿En qué te ayudamos?"
                      />
                    </label>
                    <label>
                      Mensaje
                      <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        required
                        maxLength={4000}
                        rows={5}
                        placeholder="Cuéntanos el detalle…"
                      />
                    </label>
                    {error ? <p className="help-error">{error}</p> : null}
                    <div className="help-form-actions">
                      <button type="button" className="app-panel-secondary" onClick={() => setContactOpen(false)}>
                        Cancelar
                      </button>
                      <button type="submit" className="app-panel-primary" disabled={sending}>
                        {sending ? "Enviando…" : "Enviar"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="help-contact-cta" onClick={() => setContactOpen(true)}>
                    <strong>¿Necesitas más ayuda?</strong>
                    <span>Contáctanos</span>
                  </button>
                )}
              </div>
            ) : null}
          </section>

          {helpGame ? (
            <aside className="help-side-col" aria-label="Acciones del juego">
              <div className="help-contact-block">
                {sent ? (
                  <div className="help-sent" role="status">
                    <Check size={22} aria-hidden="true" />
                    <div>
                      <strong>Mensaje enviado</strong>
                      <span>Recibimos tu consulta sobre {helpGame.name}.</span>
                    </div>
                  </div>
                ) : contactOpen ? (
                  <form className="help-contact-form" onSubmit={submitContact}>
                    <h3>Contáctanos</h3>
                    <label>
                      Asunto
                      <input value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={160} />
                    </label>
                    <label>
                      Mensaje
                      <textarea value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={4000} rows={5} />
                    </label>
                    {error ? <p className="help-error">{error}</p> : null}
                    <div className="help-form-actions">
                      <button type="button" className="app-panel-secondary" onClick={() => setContactOpen(false)}>
                        Cancelar
                      </button>
                      <button type="submit" className="app-panel-primary" disabled={sending}>
                        {sending ? "Enviando…" : "Enviar"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="help-contact-cta" onClick={() => setContactOpen(true)}>
                    <strong>¿Necesitas más ayuda?</strong>
                    <span>Contáctanos</span>
                  </button>
                )}
              </div>

              <div className="help-game-actions">
                {actionNotice ? (
                  <p className={`help-action-notice${actionNotice.includes("No se pudo") || actionNotice.includes("Inicia") ? " is-error" : ""}`}>
                    {actionNotice}
                  </p>
                ) : null}
                {confirmRemove ? (
                  <div className="help-confirm" role="alertdialog" aria-labelledby="help-confirm-title" aria-describedby="help-confirm-desc">
                    <strong id="help-confirm-title">Eliminar de tu cuenta</strong>
                    <p id="help-confirm-desc">
                      ¿Quitar «{helpGame.name}» de tu biblioteca en GameNow? El juego dejará de verse aquí; en Steam no se borra.
                    </p>
                    <div className="help-confirm-actions">
                      <button
                        type="button"
                        className="app-panel-secondary"
                        disabled={busy === "remove"}
                        onClick={() => setConfirmRemove(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="help-confirm-danger"
                        disabled={busy === "remove"}
                        onClick={() => void removeGame()}
                      >
                        {busy === "remove" ? "Eliminando…" : "Eliminar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="help-action-btn danger"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setActionNotice("");
                      setConfirmRemove(true);
                    }}
                  >
                    Eliminar juego de mi cuenta
                  </button>
                )}
                {helpGame.purchased && helpGame.saleStatus !== "pending" ? (
                  <>
                    <button
                      type="button"
                      className="help-action-btn"
                      disabled={Boolean(busy)}
                      onClick={() => void sellGame("wallet")}
                    >
                      {busy === "wallet" ? "Vendiendo…" : "Vender (cartera)"}
                    </button>
                    <button
                      type="button"
                      className="help-action-btn"
                      disabled={Boolean(busy)}
                      onClick={() => void sellGame("card")}
                    >
                      {busy === "card" ? "Vendiendo…" : "Vender (tarjeta)"}
                    </button>
                  </>
                ) : (
                  <p className="help-action-hint">
                    {helpGame.saleStatus === "pending"
                      ? "Este juego ya está vendido. El pago a tarjeta sigue en espera."
                      : "Solo puedes vender juegos comprados en GameNow."}
                  </p>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
