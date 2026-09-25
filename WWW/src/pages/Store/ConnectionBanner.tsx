import "./ConnectionBanner.css";

export function ConnectionBanner({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <section className="connection-banner" role="alert">
      <img src="/images/offers/ash-circuit.webp" alt="" />
      <div className="connection-banner-copy">
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </section>
  );
}
