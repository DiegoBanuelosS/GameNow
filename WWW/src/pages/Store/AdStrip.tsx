import type { CSSProperties } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { StoreArt } from "../../data/StoreArt";
import { useCatalog } from "../../data/CatalogContext";
import type { StoreProduct } from "../../data/catalog";
import { LogoLoader } from "./LogoLoader";
import { useHoverVideo } from "./useHoverVideo";
import "./AdStrip.css";

function cardPlace(index: number, active: number, total: number) {
  const offset = (index - active + total) % total;
  if (offset === 0) {
    return "is-center";
  }
  if (offset === 1) {
    return "is-right";
  }
  return "is-left";
}

function AdCard({
  ad,
  place,
  isCenter,
  onSelect,
}: {
  ad: StoreProduct;
  place: string;
  isCenter: boolean;
  onSelect: () => void;
}) {
  const preview = useHoverVideo(ad.trailer, { audio: true });

  return (
    <article
      className={`ad-card ${place}${preview.active ? " is-playing" : ""}`}
      style={
        preview.ratio
          ? ({ "--preview-ratio": String(preview.ratio) } as CSSProperties)
          : undefined
      }
      onPointerEnter={preview.start}
      onPointerLeave={preview.stop}
    >
      <button
        className="ad-card-hit"
        type="button"
        onClick={() => {
          onSelect();
          preview.playNow();
        }}
        onFocus={preview.start}
        onBlur={preview.stop}
        aria-current={isCenter ? "true" : undefined}
        aria-label={isCenter ? ad.alt : `Mostrar anuncio: ${ad.alt}`}
      >
        <StoreArt
          className="ad-card-art"
          src={ad.cover}
          srcSet={ad.coverSrcSet}
          sizes={ad.coverSizes}
          alt=""
        />
        {preview.loading ? (
          <div className="ad-card-loader" aria-hidden>
            <LogoLoader />
          </div>
        ) : null}
        {preview.enabled ? (
          <video
            ref={preview.videoRef}
            className={`ad-card-video${preview.active && preview.ready ? " is-on" : ""}`}
            loop
            playsInline
            preload="metadata"
            aria-hidden
            onError={preview.handleError}
            onLoadedMetadata={preview.handleMeta}
            onCanPlay={preview.handleCanPlay}
          />
        ) : null}
      </button>

      <div className="ad-card-foot">
        <div className="ad-card-meta">
          <p className="ad-card-name">{ad.name}</p>
          <p className="ad-card-studio">
            {ad.studioLogo ? (
              <StoreArt
                className="ad-card-studio-logo"
                src={ad.studioLogo}
                srcSet={ad.studioLogoSrcSet}
                sizes="32px"
                alt=""
              />
            ) : null}
            <span>{ad.studio}</span>
          </p>
        </div>
        <Link className="ad-card-buy" to={ad.href}>
          Comprar ahora
        </Link>
      </div>
    </article>
  );
}

export function AdStrip() {
  const { catalog, status } = useCatalog();
  const ads = catalog.ads;
  const [active, setActive] = useState(1);

  if (status === "loading" || !ads.length) {
    return null;
  }

  return (
    <section className="ad-strip" aria-label="Publicidad">
      <div className="ad-stage">
        {ads.map((ad, index) => {
          const place = cardPlace(index, Math.min(active, ads.length - 1), ads.length);

          return (
            <AdCard
              key={ad.slug}
              ad={ad}
              place={place}
              isCenter={place === "is-center"}
              onSelect={() => setActive(index)}
            />
          );
        })}
      </div>
    </section>
  );
}
