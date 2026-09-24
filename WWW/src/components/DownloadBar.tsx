import { useLayoutEffect, useState, useRef } from "react";
import { DOWNLOAD_BASE_BPS, DownloadJob, SpeedSample, useDownloads } from "../data/DownloadsContext";
import "./DownloadBar.css";

const GRAPH_SLOTS = 48;

function formatBytes(bytes: number) {
  const gigabytes = bytes / 1024 ** 3;
  if (gigabytes >= 1) return `${gigabytes.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

function formatDuration(seconds: number) {
  const total = Math.max(1, Math.round(seconds));
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  if (minutes < 60) {
    return remain === 0 ? `${minutes} min` : `${minutes} min ${remain} s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return remainMinutes === 0 ? `${hours} h` : `${hours} h ${remainMinutes} min`;
}

function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

function formatDownloadSpeed(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) return "0 MB/s";
  const mega = bytesPerSecond / (1024 * 1024);
  return `${mega >= 100 ? mega.toFixed(0) : mega.toFixed(1)} MB/s`;
}

function realDownloadBps(job: DownloadJob) {
  const recent = job.samples.slice(-3);
  if (recent.length === 0) return job.bytesPerSecond;
  const total = recent.reduce((sum, sample) => sum + sample.download, 0);
  return total / recent.length;
}

function formatBits(bytesPerSecond: number) {
  const bits = bytesPerSecond * 8;
  if (bits >= 1_000_000) {
    const mega = bits / 1_000_000;
    return `${mega >= 100 ? mega.toFixed(0) : mega.toFixed(1)} Mbps`;
  }
  if (bits >= 1_000) return `${(bits / 1_000).toFixed(1)} kbps`;
  return `${Math.round(bits)} bps`;
}

function remainingSeconds(job: DownloadJob, jobs: DownloadJob[]) {
  const speed = job.bytesPerSecond > 0 ? job.bytesPerSecond : DOWNLOAD_BASE_BPS;
  if (job.status === "active") {
    return Math.max(0, (job.bytesTotal - job.bytesDone) / speed);
  }
  if (job.status !== "queued") return 0;
  const index = jobs.findIndex((item) => item.slug === job.slug);
  let ahead = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    const other = jobs[cursor];
    if (other.status === "done" || other.status === "error") continue;
    ahead += Math.max(0, other.bytesTotal - other.bytesDone);
  }
  return (ahead + job.bytesTotal) / DOWNLOAD_BASE_BPS;
}

function statusLine(job: DownloadJob, jobs: DownloadJob[]) {
  if (job.status === "done") return "Listo";
  if (job.status === "error") return job.error || "No se pudo descargar";
  const size = `${formatBytes(job.bytesDone)} de ${formatBytes(job.bytesTotal)}`;
  const wait = formatDuration(remainingSeconds(job, jobs));
  const speed = formatDownloadSpeed(realDownloadBps(job));
  if (job.status === "queued") return `${size} · en cola · quedan ${wait}`;
  return `${size} · ${speed} · quedan ${wait}`;
}

const READY_LABEL = "Listo para jugar";

function ReadyLabel({ fillRatio }: { fillRatio: number }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [covered, setCovered] = useState(0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const chunk = root.parentElement ?? root;
      const box = chunk.getBoundingClientRect();
      const edge = box.left + box.width * fillRatio;
      const letters = root.querySelectorAll("span");
      let count = 0;
      letters.forEach((letter) => {
        const letterBox = letter.getBoundingClientRect();
        if (edge >= letterBox.left + letterBox.width / 2) count += 1;
      });
      setCovered((current) => (current === count ? current : count));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [fillRatio]);

  return (
    <span className="download-ready-label" ref={rootRef}>
      {READY_LABEL.split("").map((char, index) => (
        <span key={`${char}-${index}`} className={index < covered ? "is-covered" : undefined}>
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </span>
  );
}

function SpeedGraph({ samples }: { samples: SpeedSample[] }) {
  const width = 360;
  const height = 96;
  const pad = 6;
  const slot = width / GRAPH_SLOTS;
  const peak = Math.max(1, ...samples.map((sample) => sample.download));
  const line = samples
    .map((sample, index) => {
      const x = index * slot + slot / 2;
      const y = height - pad - (sample.download / peak) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="download-graph"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Descarga y velocidad de internet"
    >
      {[0.33, 0.66].map((mark) => (
        <line
          key={mark}
          className="download-graph-grid"
          x1="0"
          x2={width}
          y1={height * (1 - mark)}
          y2={height * (1 - mark)}
        />
      ))}
      {samples.map((sample, index) => {
        const barHeight = Math.max(1, (sample.download / peak) * (height - pad * 2));
        return (
          <rect
            key={index}
            className="download-graph-bar"
            x={index * slot + 1}
            y={height - pad - barHeight}
            width={Math.max(1.5, slot - 2)}
            height={barHeight}
          />
        );
      })}
      {line ? <polyline className="download-graph-line" points={line} /> : null}
    </svg>
  );
}

export function DownloadBar() {
  const { jobs, cancelDownload } = useDownloads();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const node = barRef.current;
    if (!node) {
      document.documentElement.style.setProperty("--download-bar-space", "0px");
      return;
    }
    const apply = () => {
      document.documentElement.style.setProperty("--download-bar-space", `${node.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty("--download-bar-space", "0px");
    };
  }, [jobs, openSlug]);

  if (jobs.length === 0) return null;

  return (
    <section className="download-bar" ref={barRef} aria-label="Descargas">
      <ul className="download-bar-list">
        {jobs.map((job) => {
          const percent = Math.round((job.bytesDone / job.bytesTotal) * 100);
          const downloadBps = realDownloadBps(job);
          const speedLabel = formatDownloadSpeed(job.status === "queued" ? 0 : downloadBps);
          const ready = percent >= 28;
          const readyFill = Math.min(100, (percent / 28) * 100);
          const restFill = percent <= 28 ? 0 : ((percent - 28) / 72) * 100;
          const detail = statusLine(job, jobs);
          const open = openSlug === job.slug;
          const wait = remainingSeconds(job, jobs);
          const peakDownload = Math.max(downloadBps, ...job.samples.map((sample) => sample.download), 0);
          return (
            <li key={job.slug} className={open ? "download-row is-open" : "download-row"}>
              <img className="download-thumb" src={job.cover} alt="" />
              <div className="download-copy">
                <p className="download-name">{job.name}</p>
                <p className="download-meta">{detail}</p>
                <button
                  type="button"
                  className="download-track-button"
                  aria-expanded={open}
                  aria-label={open ? `Cerrar detalle de ${job.name}` : `Ver gráfica de ${job.name}`}
                  onClick={() => setOpenSlug(open ? null : job.slug)}
                >
                  <span
                    className="download-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-valuetext={`${detail}. ${ready ? "Listo para jugar." : ""}`}
                  >
                    <span className="download-segments">
                      <span className="download-ready-chunk">
                        <span className="download-ready-fill" style={{ width: `${readyFill}%` }} />
                        <ReadyLabel fillRatio={readyFill / 100} />
                      </span>
                      <span className="download-rest">
                        <span className="download-fill" style={{ width: `${restFill}%` }} />
                      </span>
                    </span>
                    <span className="download-speed">{speedLabel}</span>
                  </span>
                </button>
              </div>
              <button
                type="button"
                className="download-cancel"
                onClick={() => cancelDownload(job.slug)}
                aria-label={`Quitar ${job.name} de las descargas`}
              >
                ×
              </button>
              {open ? (
                <div className="download-expand">
                  <SpeedGraph samples={job.samples} />
                  <div className="download-legend">
                    <span className="download-key download-key-bar">Descarga</span>
                    <span className="download-key download-key-line">Velocidad</span>
                  </div>
                  <dl className="download-stats">
                    <div>
                      <dt>Descarga</dt>
                      <dd>{speedLabel}</dd>
                    </div>
                    <div>
                      <dt>Internet</dt>
                      <dd>{formatBits(downloadBps)}</dd>
                    </div>
                    <div>
                      <dt>Máximo</dt>
                      <dd>{formatDownloadSpeed(peakDownload)}</dd>
                    </div>
                  </dl>
                  <p className="download-eta">
                    {job.status === "done"
                      ? "Tiempo restante estimado: 00:00"
                      : `Tiempo restante estimado: ${formatClock(wait)}`}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
