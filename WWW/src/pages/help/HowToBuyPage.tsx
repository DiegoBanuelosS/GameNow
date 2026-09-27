import { Link } from "react-router-dom";
import { DocPage } from "../legal/LegalPage";
import type { DocContent } from "../legal/legalDocs";

const howToBuy: DocContent = {
  title: "Cómo comprar en GameNow",
  lead: "Encuentra un juego, agrégalo al carrito, paga y empieza a descargarlo. Todo el proceso toma un par de minutos.",
  updated: "26 de septiembre de 2026",
  sections: [
    {
      id: "cuenta",
      title: "Inicia sesión",
      paragraphs: [
        "Necesitas una cuenta para comprar, porque los juegos se guardan en tu biblioteca. Si aún no tienes una, créala desde «Iniciar sesión» en la barra superior.",
      ],
    },
    {
      id: "elegir",
      title: "Elige tu juego",
      steps: [
        "Explora la tienda o entra a «Nuestros Juegos» para filtrar por género, precio y plataforma.",
        "También puedes usar el buscador de la barra superior si ya sabes qué juego quieres.",
        "Abre la página del juego para ver tráilers, reseñas y si tu PC cumple los requisitos.",
      ],
    },
    {
      id: "edicion",
      title: "Escoge la edición",
      paragraphs: [
        "Muchos juegos tienen varias ediciones, como Estándar, Deluxe o Ultimate. Cada una muestra su portada, su precio y, si está en oferta, el precio anterior tachado.",
        "Presiona «Comprar» en la edición que quieras. El juego se agrega al carrito y te llevamos ahí automáticamente.",
      ],
      tip: "Si ya tienes el juego en tu biblioteca, la edición aparecerá como «Comprado» y no se puede volver a comprar.",
    },
    {
      id: "carrito",
      title: "Revisa tu carrito",
      paragraphs: [
        "En el carrito ves todos los juegos que agregaste y el total. Usa «Quitar» si cambiaste de opinión sobre alguno. Cuando esté listo, presiona «Pagar».",
      ],
    },
    {
      id: "pago",
      title: "Paga tu pedido",
      paragraphs: ["Tienes tres formas de pagar:"],
      list: [
        "Saldo de tu cartera: si tu saldo cubre el total, presiona «Pagar con tu saldo».",
        "Tarjeta guardada: si ya compraste antes, usa «Pagar con la última tarjeta».",
        "Tarjeta nueva: llena nombre, número, vencimiento, CVV y dirección, y presiona «Pagar».",
      ],
      tip: "Aceptamos Visa, Mastercard y American Express. Si marcas «Guardar esta tarjeta», solo guardamos los últimos 4 dígitos.",
    },
    {
      id: "descargar",
      title: "Descarga y juega",
      steps: [
        "Cuando veas «Pago listo», presiona «Descargar tu contenido». Si compraste varios juegos, elige cuál descargar primero.",
        "Sigue el progreso en la barra de descargas, en la parte inferior de la pantalla.",
        "Cuando termine, el juego aparece en «Mi biblioteca» con el botón «Jugar».",
      ],
      tip: "Si cierras la página antes de descargar, no pasa nada: el juego ya es tuyo. Ábrelo desde tu biblioteca y presiona «Descargar».",
    },
    {
      id: "problemas",
      title: "Si algo sale mal",
      list: [
        "«Inicia sesión para completar el pago»: tu sesión expiró. Vuelve a iniciar sesión e inténtalo de nuevo.",
        "«Revisa el número de tarjeta» o «Revisa la fecha de vencimiento»: corrige el dato marcado e inténtalo de nuevo.",
        "«Tu saldo no alcanza para este pedido»: paga con tarjeta o quita juegos del carrito.",
        "La descarga no avanza: revisa tu conexión y reinicia GameNow.",
      ],
      tip: "Si el problema sigue, abre «Ayuda» desde el menú de tu perfil y usa «¿Necesitas más ayuda? Contáctanos».",
    },
  ],
};

export function HowToBuyPage() {
  return (
    <DocPage
      doc={howToBuy}
      nav={
        <nav className="legal-crumbs" aria-label="Ruta">
          <Link to="/">Tienda</Link>
          <span aria-hidden>/</span>
          <span>Ayuda</span>
          <span aria-hidden>/</span>
          <span aria-current="page">Cómo comprar</span>
        </nav>
      }
    >
      <div className="legal-cta">
        <p>¿Listo para tu próximo juego?</p>
        <Link to="/juegos">Ver la tienda</Link>
      </div>
    </DocPage>
  );
}
