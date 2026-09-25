import { useState } from "react";
import { apiUrl } from "../../data/api";
import { motion } from "motion/react";
import "./Download5.css";

function WindowsMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 5.479 11.049 4.37v8.03H3zM3 19.521 11.049 20.63v-7.962H3zM12.039 4.229 22.751 2.75v9.65H12.039zM12.039 12.668h10.712v9.65L12.039 20.771z" />
    </svg>
  );
}

function isWindowsClient() {
  return /Windows/i.test(navigator.userAgent);
}

export function Download5() {
  const windows = isWindowsClient();
  const [note, setNote] = useState("");

  return (
    <section className="download-5" aria-labelledby="download-5-title">
      <div className="download-5-inner">
        <motion.h2
          id="download-5-title"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Tu biblioteca,
          <br />
          una sola app.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          GameNow para Windows junta la tienda, tus compras y tu biblioteca. Sin pestañas de más:
          entra, descarga y juega.
        </motion.p>

        <motion.div
          className="download-5-actions"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {windows ? (
            <motion.a
              id="descargar-windows"
              href={apiUrl("/api/download/windows")}
              download="GameNow-Setup.exe"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setNote("Descarga en curso. Abre GameNow-Setup.exe e instala la app.");
              }}
            >
              <WindowsMark />
              Descargar GameNow para Windows
            </motion.a>
          ) : (
            <p className="download-5-status" id="descargar-windows">
              Esta app es para Windows. Ábrela desde un PC con Windows para descargarla.
            </p>
          )}
        </motion.div>
        {note ? (
          <p className="download-5-status" role="status">
            {note}
          </p>
        ) : null}
      </div>
    </section>
  );
}
