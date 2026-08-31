import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { LOGO_PATH } from "./logoPath";

gsap.registerPlugin(useGSAP, MorphSVGPlugin);

const RING_PATH =
  "M17670 7680A3600 3600 0 1 1 10470 7680A3600 3600 0 1 1 17670 7680zM16470 7680A2400 2400 0 1 0 11670 7680A2400 2400 0 1 0 16470 7680z";

export function LogoLoader() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useGSAP(
    () => {
      const path = pathRef.current;
      if (!path) {
        return;
      }

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      gsap
        .timeline({
          repeat: -1,
          yoyo: true,
          defaults: { ease: "power2.inOut" },
        })
        .to(path, {
          duration: 1.05,
          morphSVG: {
            shape: RING_PATH,
            type: "rotational",
            map: "complexity",
          },
        });
    },
    { scope: svgRef },
  );

  return (
    <svg
      ref={svgRef}
      className="ad-card-loader-mark"
      viewBox="0 0 2814 1536"
      aria-hidden
    >
      <g
        transform="translate(0 1536) scale(0.1 -0.1)"
        fill="#ffffff"
        fillRule="evenodd"
      >
        <path ref={pathRef} d={LOGO_PATH} />
      </g>
    </svg>
  );
}

export function PageLoader({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-busy="true">
      <LogoLoader />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
