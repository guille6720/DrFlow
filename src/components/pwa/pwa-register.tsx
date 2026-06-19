"use client";

import { useEffect } from "react";

/** Registra el service worker raíz para habilitar instalación PWA. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* El navegador puede rechazar SW en contextos no seguros. */
    });
  }, []);

  return null;
}
