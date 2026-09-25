import { useEffect, useState } from "react";
import { X } from "../../components/Icons";
import { useAppPanels } from "../../data/AppPanelsContext";
import "./AppPanels.css";

const PREFS_KEY = "gamenow_settings_prefs";

type Prefs = {
  cloudSync: boolean;
  hardwareAccel: boolean;
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { cloudSync: true, hardwareAccel: true };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      cloudSync: parsed.cloudSync !== false,
      hardwareAccel: parsed.hardwareAccel !== false,
    };
  } catch {
    return { cloudSync: true, hardwareAccel: true };
  }
}

export function SettingsPanel() {
  const { panel, closePanels } = useAppPanels();
  const open = panel === "settings";
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  useEffect(() => {
    if (!open) return;
    setPrefs(loadPrefs());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanels();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closePanels]);

  if (!open) return null;

  const save = () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    closePanels();
  };

  return (
    <div className="app-panel" role="dialog" aria-modal="true" aria-labelledby="settings-panel-title">
      <div className="app-panel-shell">
        <header className="app-panel-head">
          <div>
            <h2 id="settings-panel-title">Configuración</h2>
            <p>Preferencias de la aplicación GameNow</p>
          </div>
          <button type="button" className="app-panel-close" onClick={closePanels} aria-label="Cerrar">
            <X size={18} />
            <span>Cerrar</span>
          </button>
        </header>

        <div className="app-panel-body settings-panel-body">
          <div className="settings-row">
            <div>
              <strong>Idioma de la aplicación</strong>
              <span>Español (México / Internacional)</span>
            </div>
            <em>Predeterminado</em>
          </div>

          <label className="settings-row settings-row-toggle">
            <div>
              <strong>Sincronización en la nube</strong>
              <span>Guardar partidas y biblioteca automáticamente</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.cloudSync}
              onChange={(event) => setPrefs((current) => ({ ...current, cloudSync: event.target.checked }))}
            />
          </label>

          <label className="settings-row settings-row-toggle">
            <div>
              <strong>Aceleración de hardware</strong>
              <span>Optimizar rendimiento con tu GPU</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.hardwareAccel}
              onChange={(event) => setPrefs((current) => ({ ...current, hardwareAccel: event.target.checked }))}
            />
          </label>

          <button type="button" className="app-panel-primary" onClick={save}>
            Guardar preferencias
          </button>
        </div>
      </div>
    </div>
  );
}
