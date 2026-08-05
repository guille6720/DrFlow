"use client";

import { useEffect } from "react";

import { logClientError } from "@/core/errors";

/** Registra el service worker y busca actualizaciones (PWA / celular). */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let intervalId: number | undefined;
    let registration: ServiceWorkerRegistration | undefined;

    const ping = () => {
      void registration?.update().catch((err) => logClientError("pwa.service-worker-update", err));
    };

    const onFocus = () => ping();
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;
        ping();
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);
        intervalId = window.setInterval(ping, 5 * 60 * 1000);
      })
      .catch((err) => {
        logClientError("pwa.service-worker-register", err);
      });

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
