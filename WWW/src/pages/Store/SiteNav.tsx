import { useState, useRef, useEffect } from "react";
import { MagnifyingGlass, ShoppingCart } from "../../components/Icons";
import { SteamLogo } from "../../components/SteamLogo";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { SearchOverlay } from "./SearchOverlay";
import { apiUrl } from "../../data/api";
import { useDesktopApp } from "../../data/useDesktopApp";
import { useAuth } from "../../data/AuthContext";
import { useAppPanels } from "../../data/AppPanelsContext";
import { formatMxn } from "../../data/CartContext";
import "./SiteNav.css";

export function SiteNav() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const isApp = useDesktopApp();
  const { user, logout } = useAuth();
  const { openSettings, openHelp } = useAppPanels();

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
          <NavLink to="/mensajes">Mensajes</NavLink>
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
                {user.steamName && (
                  <span className="site-profile-steam-indicator" title={`Cuenta unificada con Steam: ${user.steamName}`}>
                    <SteamLogo size={12} fill="#66c0f4" />
                  </span>
                )}
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
                    {user.steamName && (
                      <div className="site-profile-dropdown-steam" title={`Cuenta de Steam: ${user.steamName}`}>
                        <SteamLogo size={12} fill="#66c0f4" />
                        <span>{user.steamName}</span>
                      </div>
                    )}
                    <div className="site-profile-dropdown-email">{user.email}</div>
                  </div>

                  <div className="site-profile-dropdown-divider" />

                  <button
                    type="button"
                    className="site-profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      openSettings();
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Configuración</span>
                  </button>

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

                  <button
                    type="button"
                    className="site-profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      openHelp();
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
    </header>
  );
}
