export function formatMxn(value: number, compact = false) {
  const amount = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
  }).format(value);
  return `$${amount} MXN`;
}
