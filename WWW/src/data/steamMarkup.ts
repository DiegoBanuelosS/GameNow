/** Convierte BBCode de Steam a HTML en el cliente (fallback / contenido en bruto). */
export function steamMarkupToHtml(raw: string) {
  let s = String(raw || "");
  if (!s) return "";

  const alreadyHtml = /<(?:h1|h2|h3|p|ul|ol|strong|em)\b/i.test(s) && !/\[(?:h1|h2|b|p)\b/i.test(s);
  if (alreadyHtml) return s;

  s = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  s = s.replace(/\\\[([^\]]+)\]/g, (_m, label) => `<h3>${String(label).trim()}</h3>`);

  s = s
    .replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, "<h1>$1</h1>")
    .replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, "<h2>$1</h2>")
    .replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, "<h3>$1</h3>")
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>")
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>")
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>")
    .replace(/\[p\]\s*\[\/p\]/gi, "")
    .replace(/\[p\]([\s\S]*?)\[\/p\]/gi, "<p>$1</p>")
    .replace(/\[hr\]\s*\[\/hr\]/gi, "<hr />")
    .replace(/\[hr\s*\/?\]/gi, "<hr />")
    .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_m, inner) => {
      const items = String(inner)
        .replace(/\[\*\]([\s\S]*?)(?:\[\/\*\]|(?=\[\*\])|$)/gi, "<li>$1</li>")
        .replace(/\[\/\*\]/gi, "")
        .trim();
      return `<ul>${items}</ul>`;
    })
    .replace(/\[\*\]/gi, "")
    .replace(/\[\/\*\]/gi, "")
    .replace(/\\[\[\]]/g, "")
    .replace(/\[(\/?(?:h1|h2|h3|p|b|i|u|list|\*|hr)[^\]]*)\]/gi, "")
    .trim();

  s = s
    .replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/gi, "<li>$1</li>")
    .replace(/<p>\s*(<(?:h1|h2|h3)\b[^>]*>[\s\S]*?<\/(?:h1|h2|h3)>)\s*<\/p>/gi, "$1")
    .replace(/<p>\s*<\/p>/gi, "");

  if (!/<(?:p|h1|h2|h3|ul|ol)\b/i.test(s) && s) {
    s = `<p>${s}</p>`;
  }

  return s;
}
