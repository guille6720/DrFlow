"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/agenda",
  "/atenciones",
  "/pacientes",
  "/historias",
  "/recetas",
  "/herramientas/farmacologia",
  "/recordatorios",
  "/telemedicina",
  "/pagos",
  "/reportes",
  "/qa",
  "/guia-pami",
  "/configuracion",
] as const;

/** Precarga rutas del panel en segundo plano (menos "Compiling" al navegar en dev). */
export function RoutePrefetcher({ routes = DASHBOARD_ROUTES }: { routes?: readonly string[] }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const prefetchAll = () => {
      routes.forEach((route, index) => {
        const timer = setTimeout(() => {
          if (!cancelled) router.prefetch(route);
        }, index * 150);
        timers.push(timer);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(prefetchAll, { timeout: 3000 });
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
        window.cancelIdleCallback(idleId);
      };
    }

    const startTimer = setTimeout(prefetchAll, 800);
    timers.push(startTimer);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [router, routes]);

  return null;
}
