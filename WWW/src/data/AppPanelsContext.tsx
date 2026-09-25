import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type HelpGameContext = {
  slug: string;
  name: string;
  cover?: string;
  purchased?: boolean;
  saleStatus?: "" | "pending";
};

type Panel = "settings" | "help" | null;

type AppPanelsContextValue = {
  panel: Panel;
  helpGame: HelpGameContext | null;
  openSettings: () => void;
  openHelp: (game?: HelpGameContext | null) => void;
  closePanels: () => void;
};

const AppPanelsContext = createContext<AppPanelsContextValue | null>(null);

export function AppPanelsProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [helpGame, setHelpGame] = useState<HelpGameContext | null>(null);

  const openSettings = useCallback(() => {
    setHelpGame(null);
    setPanel("settings");
  }, []);

  const openHelp = useCallback((game?: HelpGameContext | null) => {
    setHelpGame(game || null);
    setPanel("help");
  }, []);

  const closePanels = useCallback(() => {
    setPanel(null);
    setHelpGame(null);
  }, []);

  const value = useMemo(
    () => ({ panel, helpGame, openSettings, openHelp, closePanels }),
    [panel, helpGame, openSettings, openHelp, closePanels],
  );

  return <AppPanelsContext.Provider value={value}>{children}</AppPanelsContext.Provider>;
}

export function useAppPanels() {
  const ctx = useContext(AppPanelsContext);
  if (!ctx) throw new Error("useAppPanels debe usarse dentro de AppPanelsProvider");
  return ctx;
}
