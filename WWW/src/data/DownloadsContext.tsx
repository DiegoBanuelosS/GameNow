import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

export type DownloadStatus = "active" | "queued" | "done" | "error";

export type SpeedSample = {
  download: number;
  network: number;
};

export type DownloadJob = {
  slug: string;
  name: string;
  cover: string;
  bytesTotal: number;
  bytesDone: number;
  bytesPerSecond: number;
  networkBps: number;
  peakBps: number;
  samples: SpeedSample[];
  sampledAt: number;
  status: DownloadStatus;
  error?: string;
};

type DownloadRequest = {
  slug: string;
  name: string;
  cover: string;
};

type DownloadsContextType = {
  jobs: DownloadJob[];
  startDownload: (game: DownloadRequest) => Promise<{ ok: boolean; error?: string }>;
  cancelDownload: (slug: string) => void;
  jobFor: (slug: string) => DownloadJob | undefined;
};

const DownloadsContext = createContext<DownloadsContextType | null>(null);

const TICK_MS = 200;
const SAMPLE_MS = 1000;
const SAMPLE_LIMIT = 48;
export const DOWNLOAD_BASE_BPS = 52 * 1024 * 1024;

// Tamaño fijo por juego para que el tiempo restante sea estable.
function packageBytes(slug: string) {
  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) >>> 0;
  }
  const gigabytes = 1.2 + (hash % 480) / 100;
  return Math.round(gigabytes * 1024 * 1024 * 1024);
}

function advance(jobs: DownloadJob[], now: number) {
  let claimed = false;
  return jobs.map((job) => {
    if (job.status === "done" || job.status === "error") return job;
    if (claimed) return { ...job, status: "queued" as const, bytesPerSecond: 0 };
    claimed = true;
    const downloadWave = 0.62 + 0.38 * Math.abs(Math.sin(now / 1100));
    const bytesPerSecond = DOWNLOAD_BASE_BPS * downloadWave;
    const networkBps = bytesPerSecond;
    const bytesDone = Math.min(job.bytesTotal, job.bytesDone + bytesPerSecond * (TICK_MS / 1000));
    const finished = bytesDone >= job.bytesTotal - 1;
    const shouldSample = now - job.sampledAt >= SAMPLE_MS;
    const samples = shouldSample
      ? [...job.samples, { download: bytesPerSecond, network: networkBps }].slice(-SAMPLE_LIMIT)
      : job.samples;
    return {
      ...job,
      status: finished ? ("done" as const) : ("active" as const),
      bytesDone: finished ? job.bytesTotal : bytesDone,
      bytesPerSecond,
      networkBps,
      peakBps: Math.max(job.peakBps, bytesPerSecond, networkBps),
      samples,
      sampledAt: shouldSample ? now : job.sampledAt,
    };
  });
}

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const { updateLibraryGame } = useAuth();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const jobsRef = useRef(jobs);
  const finishing = useRef(new Set<string>());
  const generation = useRef(new Map<string, number>());
  jobsRef.current = jobs;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setJobs((current) => (current.length ? advance(current, Date.now()) : current));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    for (const job of jobs) {
      if (job.status !== "done" || finishing.current.has(job.slug)) continue;
      finishing.current.add(job.slug);
      const ticket = generation.current.get(job.slug) ?? 0;
      void updateLibraryGame(job.slug, { isInstalled: true }).then((result) => {
        if ((generation.current.get(job.slug) ?? 0) !== ticket) return;
        if (!result.ok) {
          finishing.current.delete(job.slug);
          setJobs((current) =>
            current.map((item) =>
              item.slug === job.slug
                ? { ...item, status: "error", error: result.error || "No se pudo guardar la descarga." }
                : item,
            ),
          );
          return;
        }
        window.setTimeout(() => {
          if ((generation.current.get(job.slug) ?? 0) !== ticket) return;
          finishing.current.delete(job.slug);
          setJobs((current) => current.filter((item) => item.slug !== job.slug));
        }, 1800);
      });
    }
  }, [jobs, updateLibraryGame]);

  const startDownload = useCallback((game: DownloadRequest) => {
    const existing = jobsRef.current.find((job) => job.slug === game.slug);
    if (existing && existing.status !== "error") {
      return Promise.resolve({ ok: false, error: "Ese juego ya se está descargando." });
    }
    setJobs((current) => {
      const rest = current.filter((job) => job.slug !== game.slug);
      const busy = rest.some((job) => job.status === "active" || job.status === "queued");
      const next: DownloadJob = {
        slug: game.slug,
        name: game.name,
        cover: game.cover,
        bytesTotal: packageBytes(game.slug),
        bytesDone: 0,
        bytesPerSecond: DOWNLOAD_BASE_BPS,
        networkBps: DOWNLOAD_BASE_BPS,
        peakBps: DOWNLOAD_BASE_BPS,
        samples: [],
        sampledAt: 0,
        status: busy ? "queued" : "active",
      };
      return [...rest, next];
    });
    return Promise.resolve({ ok: true });
  }, []);

  const cancelDownload = useCallback((slug: string) => {
    generation.current.set(slug, (generation.current.get(slug) ?? 0) + 1);
    finishing.current.delete(slug);
    setJobs((current) => current.filter((job) => job.slug !== slug));
  }, []);

  const jobFor = useCallback((slug: string) => jobs.find((job) => job.slug === slug), [jobs]);

  return (
    <DownloadsContext.Provider value={{ jobs, startDownload, cancelDownload, jobFor }}>
      {children}
    </DownloadsContext.Provider>
  );
}

export function useDownloads() {
  const context = useContext(DownloadsContext);
  if (!context) throw new Error("useDownloads must be used within DownloadsProvider");
  return context;
}
