import { useState } from "react";
import { MagnifyingGlass, ShoppingCart } from "../../components/Icons";
import { Link, NavLink } from "react-router-dom";
import { SearchOverlay } from "./SearchOverlay";
import { useDesktopApp } from "../../data/useDesktopApp";
import "./SiteNav.css";

export function SiteNav() {
  const [searchOpen, setSearchOpen] = useState(false);
  const isApp = useDesktopApp();

  return (
    <header className="site-header">
      <div className="site-header-bar">
        <Link className="site-brand" to="/">
          <img
            src="/logotipes/logotipe-mark.svg"
            alt="GameNow"
            width="341"
            height="294"
          />
        </Link>
        <nav className="site-nav" aria-label="Principal">
          <NavLink to="/" end>
            Tienda
          </NavLink>
          <NavLink to="/library">Mi biblioteca</NavLink>
          <NavLink to="/auth">Iniciar sesión</NavLink>
          {!isApp && (
            <a
              href="/api/download/windows"
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
          <Link to="/cart" aria-label="Carrito">
            <ShoppingCart size={22} weight="bold" />
          </Link>
        </div>
      </div>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
