"use client";

import { useEffect } from "react";

/**
 * Registra el SW del portal pacientes (scope /portal/) y quita el SW del consultorio
 * para que Chrome trate la app verde como PWA separada de la azul del médico.
 */
export function PortalPwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    async function setup() {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          const script =
            reg.active?.scriptURL ??
            reg.waiting?.scriptURL ??
            reg.installing?.scriptURL ??
            "";
          if (script.includes("/sw.js") && !script.includes("sw-portal")) {
            await reg.unregister();
          }
        }

        await navigator.serviceWorker.register("/sw-portal.js", {
          scope: "/portal/",
        });
      } catch {
        /* SW no disponible en este contexto */
      }
    }

    void setup();
  }, []);

  return null;
}
