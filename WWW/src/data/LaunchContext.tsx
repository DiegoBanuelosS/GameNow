import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";

export type LaunchTarget = {
  name: string;
  image: string;
  images: string[];
  cover: string;
  steamAppId?: string;
  slug?: string;
  error?: string;
};

type LaunchContextType = {
  launch: LaunchTarget | null;
  notice: LaunchTarget | null;
  startLaunch: (target: LaunchTarget) => void;
  stopLaunch: () => void;
  failLaunch: (error?: string) => void;
  clearNotice: () => void;
};

const LaunchContext = createContext<LaunchContextType | null>(null);

export function LaunchProvider({ children }: { children: ReactNode }) {
  const [launch, setLaunch] = useState<LaunchTarget | null>(null);
  const [notice, setNotice] = useState<LaunchTarget | null>(null);
  const launchRef = useRef(launch);
  launchRef.current = launch;

  const startLaunch = useCallback((target: LaunchTarget) => {
    setNotice(null);
    setLaunch(target);
  }, []);
  const stopLaunch = useCallback(() => setLaunch(null), []);
  const failLaunch = useCallback((error?: string) => {
    const current = launchRef.current;
    if (current) setNotice({ ...current, ...(error ? { error } : {}) });
    setLaunch(null);
  }, []);
  const clearNotice = useCallback(() => setNotice(null), []);

  return (
    <LaunchContext.Provider value={{ launch, notice, startLaunch, stopLaunch, failLaunch, clearNotice }}>
      {children}
    </LaunchContext.Provider>
  );
}

export function useLaunch() {
  const context = useContext(LaunchContext);
  if (!context) throw new Error("useLaunch must be used within LaunchProvider");
  return context;
}
