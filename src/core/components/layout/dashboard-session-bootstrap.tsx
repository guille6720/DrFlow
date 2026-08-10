"use client";

import { useEffect, useRef } from "react";

const BOOTSTRAP_SESSION_KEY = "drflow_session_bootstrapped";

/** Runs post-login bootstrap on dashboard load (membership + clinic cookie). */
export function DashboardSessionBootstrap() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void fetch("/api/auth/bootstrap", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {
      // Non-blocking: server layout also runs prepareDashboardSession.
    });
  }, []);

  return null;
}

export function clearDashboardSessionBootstrapFlag() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(BOOTSTRAP_SESSION_KEY);
}
