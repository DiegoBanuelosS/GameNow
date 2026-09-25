import { useState, useRef, useEffect } from "react";
import { MagnifyingGlass, ShoppingCart, X } from "../../components/Icons";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { SearchOverlay } from "./SearchOverlay";
import { apiUrl } from "../../data/api";
import { useDesktopApp } from "../../data/useDesktopApp";
import { useAuth } from "../../data/AuthContext";
import { formatMxn } from "../../data/CartContext";
import "./SiteNav.css";

export function SiteNav() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"settings" | "help" | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const isApp = useDesktopApp();
  const { user, logout } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [profileMenuOpen]);

  return (
    <header className="site-header">
      <div className="site-header-bar">
        <Link className="site-brand" to="/" aria-label="GameNow">
          <img src="/logotipes/logotipe-mark-clean.svg" alt="GameNow" />
        </Link>
        <nav className="site-nav" aria-label="Principal">
          <NavLink to="/" end>
            Tienda
          </NavLink>
          <NavLink to="/library">Mi biblioteca</NavLink>
          <NavLink to="/amigos">Mis Amigos</NavLink>
          {user ? (
            <div className="site-profile-menu-wrap" ref={profileRef}>
              <button
                type="button"
                className={`site-profile-trigger ${profileMenuOpen ? "active" : ""}`}
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="true"
              >
                <span className="site-profile-avatar-circle">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="site-profile-avatar-img" />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="site-profile-username">{user.username}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`site-profile-arrow ${profileMenuOpen ? "open" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {profileMenuOpen && (
                <div className="site-profile-dropdown" role="menu">
                  <div className="site-profile-dropdown-user-header">
                    <div className="site-profile-dropdown-name">{user.username}</div>
                    <div className="site-profile-dropdown-email">{user.email}</div>
                  </div>

                  <div className="site-profile-dropdown-divider" />

                  {/* 1. CONFIGURACIÓN */}
                  <button
                    type="button"
                    className="site-profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setActiveModal("settings");
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Configuración</span>
                  </button>

                  {/* 2. MI PERFIL */}
                  <button
                    type="button"
                    className="site-profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate("/profile");
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Mi perfil</span>
                  </button>

                  {/* 3. AYUDA */}
                  <button
                    type="button"
                    className="site-profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setActiveModal("help");
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Ayuda</span>
                  </button>

                  <div className="site-profile-dropdown-divider" />

                  {/* CERRAR SESIÓN */}
                  <button
                    type="button"
                    className="site-profile-dropdown-item logout"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <NavLink to="/auth">Iniciar sesión</NavLink>
          )}
          {!isApp && (
            <a
              href={apiUrl("/api/download/windows")}
              download="GameNow-Setup.exe"
              className="site-nav-download"
              title="Descargar instalador de GameNow para Windows"
            >
              Descargar
            </a>
          )}
        </nav>
        <div className="site-tools">
          <button
            type="button"
            aria-label="Buscar"
            aria-expanded={searchOpen}
            aria-haspopup="dialog"
            aria-controls="site-search"
            onClick={() => setSearchOpen(true)}
          >
            <MagnifyingGlass size={22} weight="bold" />
          </button>
          <div className="site-cart">
            {user && (user.balance || 0) > 0 ? (
              <span className="site-wallet">{formatMxn(user.balance || 0)}</span>
            ) : null}
            <Link to="/cart" aria-label="Carrito">
              <ShoppingCart size={22} weight="bold" />
            </Link>
          </div>
        </div>
      </div>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />



      {/* MODAL: CONFIGURACIÓN */}
      {activeModal === "settings" && (
        <div className="library-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="library-modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="library-modal-close"
              onClick={() => setActiveModal(null)}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
            <div className="library-modal-header">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" color="var(--color-accent-primary)">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#fff" }}>Configuración</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#fff" }}>Idioma de la aplicación</div>
                  <div style={{ fontSize: "11px", color: "var(--color-fg-muted)" }}>Español (México / Internacional)</div>
                </div>
                <span style={{ fontSize: "12px", color: "var(--color-accent-primary)", fontWeight: 600 }}>Predeterminado</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#fff" }}>Sincronización en la nube</div>
                  <div style={{ fontSize: "11px", color: "var(--color-fg-muted)" }}>Guardar partidas y biblioteca automáticamente</div>
                </div>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--color-accent-primary)", width: "16px", height: "16px", cursor: "pointer" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#fff" }}>Aceleración de hardware</div>
                  <div style={{ fontSize: "11px", color: "var(--color-fg-muted)" }}>Optimizar rendimiento con tu GPU</div>
                </div>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--color-accent-primary)", width: "16px", height: "16px", cursor: "pointer" }} />
              </div>
            </div>

            <button
              type="button"
              className="library-modal-submit-btn"
              onClick={() => setActiveModal(null)}
              style={{ marginTop: "8px" }}
            >
              Guardar preferencias
            </button>
          </div>
        </div>
      )}

      {/* MODAL: AYUDA */}
      {activeModal === "help" && (
        <div className="library-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="library-modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="library-modal-close"
              onClick={() => setActiveModal(null)}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
            <div className="library-modal-header">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" color="#38bdf8">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#fff" }}>Centro de ayuda</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
              <div style={{ padding: "10px", background: "#111", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }}>
                <h4 style={{ margin: "0 0 4px", fontSize: "13px", color: "#fff" }}>¿Cómo vinculo mi cuenta de Steam?</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--color-fg-muted)", lineHeight: 1.4 }}>
                  Entra a tu Biblioteca y haz clic en «Vincular Steam». Introduce tu Steam ID o enlace de perfil asegurándote de que tus juegos sean públicos.
                </p>
              </div>

              <div style={{ padding: "10px", background: "#111", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }}>
                <h4 style={{ margin: "0 0 4px", fontSize: "13px", color: "#fff" }}>¿Mis partidas se sincronizan automáticamente?</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--color-fg-muted)", lineHeight: 1.4 }}>
                  Sí, GameNow guarda y sincroniza el tiempo jugado y los títulos vinculados en tu cuenta personal.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="library-modal-submit-btn"
              onClick={() => setActiveModal(null)}
              style={{ marginTop: "8px" }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
