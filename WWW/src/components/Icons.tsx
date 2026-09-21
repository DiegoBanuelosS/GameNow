export function MagnifyingGlass({
  size = 22,
  weight = "regular",
  className,
  "aria-hidden": ariaHidden,
}: {
  size?: number;
  weight?: string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  const strokeWidth = weight === "bold" ? 24 : 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden ?? true}
    >
      <circle cx="112" cy="112" r="80" />
      <line x1="168.5" y1="168.5" x2="224" y2="224" />
    </svg>
  );
}

export function ShoppingCart({
  size = 22,
  weight = "regular",
  className,
  "aria-hidden": ariaHidden,
}: {
  size?: number;
  weight?: string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  const strokeWidth = weight === "bold" ? 24 : 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden ?? true}
    >
      <path d="M184,184H69.8L41.9,32H16" />
      <circle cx="80" cy="204" r="20" fill={weight === "bold" ? "currentColor" : "none"} />
      <circle cx="184" cy="204" r="20" fill={weight === "bold" ? "currentColor" : "none"} />
      <path d="M62.5,144H189.1a16,16,0,0,0,15.7-12.8L216,64H48" />
    </svg>
  );
}

export function X({
  size = 24,
  weight = "regular",
  className,
  "aria-hidden": ariaHidden,
}: {
  size?: number;
  weight?: string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  const strokeWidth = weight === "bold" ? 24 : 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden ?? true}
    >
      <line x1="200" y1="56" x2="56" y2="200" />
      <line x1="200" y1="200" x2="56" y2="56" />
    </svg>
  );
}

export function Star({
  size = 18,
  weight = "regular",
  className,
  "aria-hidden": ariaHidden,
}: {
  size?: number;
  weight?: "fill" | "regular" | string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  const isFilled = weight === "fill";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill={isFilled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={isFilled ? "0" : "16"}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden ?? true}
    >
      <path d="M234.5,114.38l-45.1,39.36,13.51,58.6a16,16,0,0,1-23.84,17.34l-51.11-31-51,31a16,16,0,0,1-23.84-17.34L66.6,153.74,21.5,114.38a16,16,0,0,1,9.11-28.06l59.46-5.15,23.21-55.36a15.95,15.95,0,0,1,29.44,0h0L166,81.17l59.44,5.15a16,16,0,0,1,9.11,28.06Z" />
    </svg>
  );
}
