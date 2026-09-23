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
  fallbacks?: string[];
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
  fallbacks,
}: StoreArtProps) {
  const [failed, setFailed] = useState(!src);
  const chain = useRef<string[]>([]);
  const extra = JSON.stringify(fallbacks ?? []);

  useEffect(() => {
    const parsed = extra ? (JSON.parse(extra) as string[]) : [];
    chain.current = [fallback, ...parsed].filter((url): url is string => Boolean(url));
    setFailed(!src);
  }, [src, fallback, extra]);

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
        const next = chain.current.find((url) => url && image.src !== url);
        if (next) {
          chain.current = chain.current.filter((url) => url !== next);
          image.srcset = "";
          image.src = next;
          return;
        }
        setFailed(true);
      }}
    />
  );
}
