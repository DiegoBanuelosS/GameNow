export type LegalSlug = "privacidad" | "terminos" | "cookies";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  list?: string[];
  steps?: string[];
  tip?: string;
  table?: { head: string[]; rows: string[][] };
};

export type DocContent = {
  title: string;
  lead: string;
  updated: string;
  sections: LegalSection[];
};

export type LegalDoc = DocContent & {
  slug: LegalSlug;
  tab: string;
};

const UPDATED = "26 de septiembre de 2026";
const CONTACT = "legal@gamenow.gg";

export const legalDocs: LegalDoc[] = [
  {
    slug: "privacidad",
    tab: "Privacidad",
    title: "Aviso de privacidad",
    lead: "Qué datos recopilamos cuando usas GameNow, para qué los usamos y cómo puedes controlarlos.",
    updated: UPDATED,
    sections: [
      {
        id: "responsable",
        title: "Quién es responsable de tus datos",
        paragraphs: [
          "GameNow es responsable del tratamiento de los datos personales que nos compartes al usar la tienda, la biblioteca, el chat y la aplicación de escritorio.",
          `Si tienes dudas sobre este aviso, escríbenos a ${CONTACT}.`,
        ],
      },
      {
        id: "datos",
        title: "Datos que recopilamos",
        paragraphs: ["Recopilamos solo lo necesario para que la cuenta y las compras funcionen:"],
        list: [
          "Datos de cuenta: nombre de usuario, correo y contraseña cifrada.",
          "Datos de perfil: avatar, fondo de perfil y, si la vinculas, tu cuenta de Steam.",
          "Compras: juegos adquiridos, montos, fecha y método de pago (no guardamos el número completo de tu tarjeta).",
          "Actividad social: solicitudes de amistad, lista de amigos y mensajes del chat.",
          "Datos técnicos: tipo de dispositivo, sistema operativo, idioma y registros de errores.",
        ],
      },
      {
        id: "uso",
        title: "Para qué usamos tus datos",
        list: [
          "Crear y mantener tu cuenta.",
          "Procesar compras y entregar los juegos en tu biblioteca.",
          "Mostrar recomendaciones según tu biblioteca y tus preferencias.",
          "Enviar notificaciones sobre descargas, mensajes y solicitudes de amistad.",
          "Detectar fraude y proteger la seguridad de las cuentas.",
          "Enviarte novedades de la tienda, solo si te suscribes.",
        ],
      },
      {
        id: "compartir",
        title: "Con quién los compartimos",
        paragraphs: [
          "No vendemos tus datos personales. Solo los compartimos con proveedores que nos ayudan a operar el servicio, como procesadores de pago, alojamiento de servidores y almacenamiento de imágenes, bajo acuerdos de confidencialidad.",
          "También podemos compartirlos cuando una autoridad competente lo requiera conforme a la ley.",
        ],
      },
      {
        id: "conservacion",
        title: "Cuánto tiempo los conservamos",
        paragraphs: [
          "Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, borramos o anonimizamos tus datos en un plazo de 30 días, salvo los registros de compras que la ley nos obliga a guardar.",
        ],
      },
      {
        id: "derechos",
        title: "Tus derechos",
        paragraphs: ["Puedes pedirnos en cualquier momento:"],
        list: [
          "Acceder a los datos que tenemos sobre ti.",
          "Corregir datos incorrectos o incompletos.",
          "Eliminar tu cuenta y tus datos.",
          "Oponerte al uso de tus datos para fines de marketing.",
        ],
      },
      {
        id: "contacto",
        title: "Cómo ejercer tus derechos",
        paragraphs: [
          `Escríbenos a ${CONTACT} desde el correo de tu cuenta. Responderemos en un plazo máximo de 20 días hábiles.`,
        ],
      },
    ],
  },
  {
    slug: "terminos",
    tab: "Términos",
    title: "Términos y condiciones",
    lead: "Las reglas para usar GameNow, comprar juegos y convivir con otros jugadores.",
    updated: UPDATED,
    sections: [
      {
        id: "aceptacion",
        title: "Aceptación",
        paragraphs: [
          "Al crear una cuenta o usar GameNow aceptas estos términos. Si no estás de acuerdo, no uses el servicio.",
        ],
      },
      {
        id: "cuenta",
        title: "Tu cuenta",
        list: [
          "Debes tener al menos 13 años, o la edad mínima que marque la ley de tu país.",
          "Eres responsable de mantener tu contraseña en secreto.",
          "La cuenta es personal y no se puede vender ni transferir.",
          "Avísanos si crees que alguien entró a tu cuenta sin permiso.",
        ],
      },
      {
        id: "compras",
        title: "Compras y licencias",
        paragraphs: [
          "Cuando compras un juego obtienes una licencia personal, no exclusiva e intransferible para jugarlo desde tu cuenta. No adquieres la propiedad del juego.",
          "Los precios se muestran en pesos mexicanos e incluyen impuestos, salvo que se indique lo contrario.",
        ],
      },
      {
        id: "reembolsos",
        title: "Reembolsos",
        paragraphs: [
          "Puedes solicitar un reembolso dentro de los 14 días posteriores a la compra, siempre que hayas jugado menos de 2 horas. Los reembolsos se devuelven al método de pago original.",
        ],
      },
      {
        id: "conducta",
        title: "Conducta",
        paragraphs: ["Para que la comunidad funcione, no está permitido:"],
        list: [
          "Acosar, amenazar o suplantar a otros usuarios.",
          "Compartir contenido ilegal, violento o sexual explícito en el chat o el perfil.",
          "Usar trampas, bots o programas que alteren el funcionamiento del servicio.",
          "Intentar acceder a cuentas o sistemas que no te pertenecen.",
        ],
      },
      {
        id: "suspension",
        title: "Suspensión de cuentas",
        paragraphs: [
          "Podemos suspender o cerrar cuentas que incumplan estos términos. Si cerramos tu cuenta por error, te devolveremos el acceso a tu biblioteca.",
        ],
      },
      {
        id: "responsabilidad",
        title: "Limitación de responsabilidad",
        paragraphs: [
          "GameNow se ofrece tal cual. Trabajamos para que esté disponible siempre, pero puede haber interrupciones por mantenimiento o fallas técnicas. No somos responsables del contenido de juegos de terceros.",
        ],
      },
      {
        id: "cambios",
        title: "Cambios a estos términos",
        paragraphs: [
          "Si hacemos cambios importantes te avisaremos con al menos 15 días de anticipación por correo o dentro de la aplicación.",
          `Para cualquier duda escribe a ${CONTACT}.`,
        ],
      },
    ],
  },
  {
    slug: "cookies",
    tab: "Cookies",
    title: "Política de cookies",
    lead: "Qué cookies y tecnologías similares usa GameNow y cómo puedes desactivarlas.",
    updated: UPDATED,
    sections: [
      {
        id: "que-son",
        title: "Qué son las cookies",
        paragraphs: [
          "Las cookies son pequeños archivos que el navegador guarda en tu dispositivo. También usamos almacenamiento local, que funciona de forma parecida, para recordar tu sesión y tus preferencias.",
        ],
      },
      {
        id: "tipos",
        title: "Cookies que usamos",
        table: {
          head: ["Tipo", "Para qué sirve", "Duración"],
          rows: [
            ["Necesarias", "Mantener tu sesión iniciada, el carrito y la seguridad de la cuenta.", "Sesión o hasta 30 días"],
            ["Preferencias", "Recordar idioma, volumen de los tráilers y ajustes de la tienda.", "Hasta 1 año"],
            ["Rendimiento", "Medir qué páginas cargan lento para mejorarlas.", "Hasta 90 días"],
            ["Recomendaciones", "Sugerir juegos según lo que exploras en la tienda.", "Hasta 6 meses"],
          ],
        },
      },
      {
        id: "terceros",
        title: "Cookies de terceros",
        paragraphs: [
          "Algunos contenidos, como los tráilers de YouTube o el inicio de sesión con Steam, pueden guardar sus propias cookies. Esos servicios tienen sus propias políticas de privacidad.",
        ],
      },
      {
        id: "control",
        title: "Cómo desactivarlas",
        paragraphs: [
          "Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Si bloqueas las cookies necesarias, no podrás iniciar sesión ni comprar.",
        ],
        list: [
          "Chrome y Edge: Configuración › Privacidad y seguridad › Cookies.",
          "Firefox: Ajustes › Privacidad y seguridad.",
          "Safari: Ajustes › Privacidad.",
        ],
      },
      {
        id: "contacto-cookies",
        title: "Contacto",
        paragraphs: [`Si tienes preguntas sobre esta política, escríbenos a ${CONTACT}.`],
      },
    ],
  },
];

export function legalDoc(slug: LegalSlug) {
  return legalDocs.find((doc) => doc.slug === slug) ?? legalDocs[0];
}
