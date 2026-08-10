"use client";

import { useEffect, useRef } from "react";

const BOOTSTRAP_SESSION_KEY = "drflow_session_bootstrapped";

/** Runs post-login bootstrap once per browser session (membership + clinic cookie). */
export function DashboardSessionBootstrap() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (sessionStorage.getItem(BOOTSTRAP_SESSION_KEY) === "1") return;

    void fetch("/api/auth/bootstrap", {
      method: "POST",
      credentials: "same-origin",
    })
      .then((response) => {
        if (response.ok) {
          sessionStorage.setItem(BOOTSTRAP_SESSION_KEY, "1");
        }
      })
      .catch(() => {
        // Non-blocking: dashboard still loads with cached session state.
      });
  }, []);

  return null;
}

export function clearDashboardSessionBootstrapFlag() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(BOOTSTRAP_SESSION_KEY);
}
