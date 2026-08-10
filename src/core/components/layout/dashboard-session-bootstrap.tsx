"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const BOOTSTRAP_SESSION_KEY = "drflow_session_bootstrapped";

/** Runs post-login bootstrap once per browser session (membership + clinic cookie). */
export function DashboardSessionBootstrap() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (sessionStorage.getItem(BOOTSTRAP_SESSION_KEY) === "1") return;

    void (async () => {
      try {
        const response = await fetch("/api/auth/bootstrap", {
          method: "POST",
          credentials: "same-origin",
        });
        if (!response.ok) return;

        sessionStorage.setItem(BOOTSTRAP_SESSION_KEY, "1");
        router.refresh();
      } catch {
        // Non-blocking: dashboard still loads with cached session state.
      }
    })();
  }, [router]);

  return null;
}

export function clearDashboardSessionBootstrapFlag() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(BOOTSTRAP_SESSION_KEY);
}
