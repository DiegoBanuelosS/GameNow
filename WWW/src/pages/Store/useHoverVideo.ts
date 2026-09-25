import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { youtubeId } from "../../data/youtube";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

export function useHoverVideo(src?: string, options?: { audio?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const source = src?.trim() || "";
  const embedId = youtubeId(source);
  const withAudio = Boolean(options?.audio);
  const enabled = Boolean(source) && !reducedMotion && !failed;
  const loading = enabled && active && !ready && !embedId;

  useEffect(() => {
    setFailed(false);
    setReady(false);
    setRatio(null);
    setActive(false);
  }, [source]);

  useEffect(() => {
    if (embedId) {
      setRatio(16 / 9);
      return;
    }

    const video = videoRef.current;
    if (!video || !enabled) {
      return;
    }

    if (!active) {
      video.pause();
      video.muted = true;
      if (video.currentTime) {
        video.currentTime = 0;
      }
      return;
    }

    const stream = source.includes(".m3u8");
    let hls: Hls | null = null;
    if (stream && Hls.isSupported()) {
      video.removeAttribute("src");
      hls = new Hls({ capLevelToPlayerSize: true });
      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setFailed(true);
          setActive(false);
          setReady(false);
        }
      });
    } else if (video.getAttribute("src") !== source) {
      video.src = source;
      video.load();
    }

    video.muted = !withAudio;
    video.volume = withAudio ? 1 : 0;
    void video.play().catch(() => {
      if (!withAudio) {
        return;
      }
      video.muted = true;
      void video.play().catch(() => undefined);
    });

    return () => {
      hls?.destroy();
    };
  }, [active, embedId, enabled, source, withAudio]);

  const start = useCallback(() => {
    if (!enabled) {
      return;
    }
    setActive(true);
  }, [enabled]);

  const playNow = useCallback(() => {
    if (!enabled) {
      return;
    }
    const video = videoRef.current;
    setActive(true);
    if (!video) {
      return;
    }
    video.muted = !withAudio;
    video.volume = withAudio ? 1 : 0;
    void video.play().catch(() => undefined);
  }, [enabled, withAudio]);

  const stop = useCallback(() => {
    setActive(false);
  }, []);

  const handleError = useCallback(() => {
    if (source.includes(".m3u8")) {
      return;
    }
    const video = videoRef.current;
    if (!video?.getAttribute("src")) {
      return;
    }
    setFailed(true);
    setActive(false);
    setReady(false);
    setRatio(null);
  }, [source]);

  const handleMeta = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      return;
    }
    setRatio(video.videoWidth / video.videoHeight);
  }, []);

  const handleCanPlay = useCallback(() => {
    setReady(true);
    const video = videoRef.current;
    if (!active || !video) {
      return;
    }
    video.muted = !withAudio;
    video.volume = withAudio ? 1 : 0;
    void video.play().catch(() => {
      if (!withAudio) {
        return;
      }
      video.muted = true;
      void video.play().catch(() => undefined);
    });
  }, [active, withAudio]);

  return {
    videoRef,
    embedId,
    active,
    ready,
    loading,
    enabled,
    ratio,
    start,
    playNow,
    stop,
    handleError,
    handleMeta,
    handleCanPlay,
  };
}
