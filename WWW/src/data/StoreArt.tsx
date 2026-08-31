import { useEffect, useRef, useState } from "react";
import "./StoreArt.css";

type StoreArtProps = {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fallback?: string;
};

export function StoreArt({
  src,
  srcSet,
  sizes,
  alt,
  className,
  width,
  height,
  fallback,
}: StoreArtProps) {
  const [failed, setFailed] = useState(!src);
  const usedFallback = useRef(false);

  useEffect(() => {
    setFailed(!src);
    usedFallback.current = false;
  }, [src, fallback]);

  const frameClass = ["store-art-missing", className].filter(Boolean).join(" ");

  if (failed) {
    return (
      <span
        className={frameClass}
        role="img"
        aria-label={alt || "Imagen no disponible"}
        style={width || height ? { width, height } : undefined}
      >
        <img src="/logotipes/logotipe-mark.svg" alt="" width="88" height="76" />
        <span>Imagen no disponible</span>
      </span>
    );
  }

  return (
    <img
      className={className}
      src={src}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      decoding="async"
      onError={(event) => {
        const image = event.currentTarget;
        if (fallback && !usedFallback.current && image.src !== fallback) {
          usedFallback.current = true;
          image.srcset = "";
          image.src = fallback;
          return;
        }
        setFailed(true);
      }}
    />
  );
}
