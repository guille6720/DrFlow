"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { UserRole } from "@/types/database";

const CORE_DASHBOARD_ROUTES = [
  "/dashboard",
  "/pacientes",
  "/turnos/agenda",
  "/historias",
  "/caja",
] as const;

const STAFF_EXTRA_ROUTES = ["/ingreso-profesionales", "/configuracion"] as const;

function routesForRole(role: UserRole | null, isSuperadmin: boolean): readonly string[] {
  if (isSuperadmin || role === "superadmin" || role === "clinic_admin") {
    return [...CORE_DASHBOARD_ROUTES, ...STAFF_EXTRA_ROUTES];
  }
  if (role === "secretary") {
    return [...CORE_DASHBOARD_ROUTES, "/turnos/lista-espera", "/sala-espera"];
  }
  return CORE_DASHBOARD_ROUTES;
}

/** Precarga rutas clave del panel en idle — acotado por rol para no competir con la navegación real. */
export function RoutePrefetcher({
  role,
  isSuperadmin = false,
}: {
  role?: UserRole | null;
  isSuperadmin?: boolean;
}) {
  const router = useRouter();
  const routes = routesForRole(role ?? null, isSuperadmin);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const prefetchAll = () => {
      routes.forEach((route, index) => {
        const timer = setTimeout(() => {
          if (!cancelled) router.prefetch(route);
        }, 400 + index * 250);
        timers.push(timer);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(prefetchAll, { timeout: 5000 });
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
        window.cancelIdleCallback(idleId);
      };
    }

    const startTimer = setTimeout(prefetchAll, 1200);
    timers.push(startTimer);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [router, routes]);

  return null;
}
