import { useCallback, useEffect, useRef, useState } from "react";

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
  const withAudio = Boolean(options?.audio);
  const enabled = Boolean(source) && !reducedMotion && !failed;
  const loading = enabled && active && !ready;

  useEffect(() => {
    setFailed(false);
    setReady(false);
    setRatio(null);
    setActive(false);
  }, [source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled) {
      return;
    }

    if (video.getAttribute("src") !== source) {
      video.src = source;
      video.load();
    }

    if (!active) {
      video.pause();
      video.muted = true;
      if (video.currentTime) {
        video.currentTime = 0;
      }
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
  }, [active, enabled, source, withAudio]);

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
    const video = videoRef.current;
    if (!video?.getAttribute("src")) {
      return;
    }
    setFailed(true);
    setActive(false);
    setReady(false);
    setRatio(null);
  }, []);

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
