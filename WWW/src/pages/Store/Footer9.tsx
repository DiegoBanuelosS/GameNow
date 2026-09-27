import { motion, useReducedMotion, type Variants } from "motion/react";
import { Link } from "react-router-dom";
import { useDesktopApp } from "../../data/useDesktopApp";
import "./Footer9.css";

const columns: {
  title: string;
  links: { label: string; to: string; badge?: string }[];
}[] = [
  {
    title: "Tienda",
    links: [
      { label: "Tienda", to: "/" },
      { label: "Nuestros Juegos", to: "/juegos" },
      { label: "Eventos y Ofertas", to: "/#eventos" },
      { label: "Descargar", to: "/#descargar-windows" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { label: "Iniciar sesión", to: "/auth" },
      { label: "Mi biblioteca", to: "/library" },
      { label: "Mensajes", to: "/mensajes" },
      { label: "Carrito", to: "/cart" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Cómo comprar", to: "/ayuda/como-comprar" },
      { label: "Biblioteca", to: "/library" },
    ],
  },
];

const legal = [
  { label: "Privacidad", to: "/privacidad" },
  { label: "Términos", to: "/terminos" },
  { label: "Cookies", to: "/cookies" },
];

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

export function Footer9() {
  const reduce = useReducedMotion();
  const isApp = useDesktopApp();

  const activeColumns = columns.map((col) => ({
    ...col,
    links: isApp
      ? col.links.filter(
          (l) => l.label !== "Descargar" && l.to !== "/#descargar-windows"
        )
      : col.links,
  }));

  return (
    <footer className="footer-9">
      <motion.div
        className="footer-9-inner"
        variants={container}
        initial={reduce ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        <div className="footer-9-top">
          <div className="footer-9-sitemap">
            {activeColumns.map((column) => (
              <motion.nav key={column.title} variants={item} aria-label={column.title}>
                <h2 className="footer-9-capsule">{column.title}</h2>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to}>
                        {link.label}
                        {link.badge ? <span className="footer-9-badge">{link.badge}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.nav>
            ))}
          </div>

          <motion.div className="footer-9-aside" variants={item}>
            <div className="footer-9-card">
              <div className="footer-9-card-media">
                <img src="/images/offers/pale-crown.webp" alt="" width="800" height="450" />
              </div>
              <h2>Novedades de la tienda</h2>
              <p>Suscríbete para mantenerte al día de las ofertas, cambios y novedades.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                }}
              >
                <label htmlFor="footer-9-email" className="visually-hidden">
                  Correo
                </label>
                <input
                  id="footer-9-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Tu correo"
                  required
                />
                <button type="submit">Suscribirme</button>
              </form>
            </div>
          </motion.div>
        </div>

        <motion.div className="footer-9-wordmark" variants={item} aria-hidden>
          <svg viewBox="0 0 720 170" focusable="false">
            <text
              x="360"
              y="148"
              textAnchor="middle"
              textLength="700"
              lengthAdjust="spacingAndGlyphs"
            >
              GameNow
            </text>
          </svg>
        </motion.div>

        <motion.div className="footer-9-legal" variants={item}>
          <p>© 2026 GameNow</p>
          <nav aria-label="Legal">
            {legal.map((link) => (
              <Link key={link.label} to={link.to}>
                {link.label}
              </Link>
            ))}
          </nav>
        </motion.div>
      </motion.div>
    </footer>
  );
}

export default Footer9;
