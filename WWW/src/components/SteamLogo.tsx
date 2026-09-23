import React from "react";

interface SteamLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  fill?: string;
}

/**
 * Official Valve Steam Brand Logo SVG
 */
export function SteamLogo({
  size = 20,
  className = "",
  fill = "currentColor",
  ...props
}: SteamLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.524-4.524 4.524h-.105l-4.076 2.811c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.707L.436 15.07C1.82 20.211 6.453 24 11.979 24c6.627 0 12-5.373 12-12s-5.373-12-12-12zM8.544 18.067c-.201-.082-.416-.145-.646-.145-.94 0-1.705.764-1.705 1.705 0 .285.074.551.197.786l-2.02-.835c.29-.838 1.076-1.442 2.016-1.479l2.158-3.125a2.533 2.533 0 0 1 .475.253l-.475 2.84zm7.403-6.845c-1.25 0-2.262-1.013-2.262-2.263 0-1.25 1.012-2.262 2.262-2.262 1.25 0 2.262 1.012 2.262 2.262 0 1.25-1.012 2.263-2.262 2.263z" />
    </svg>
  );
}
