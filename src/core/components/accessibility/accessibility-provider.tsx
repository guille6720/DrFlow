"use client";

import { useEffect } from "react";
import { REDUCED_MOTION_STORAGE_KEY } from "@/core/accessibility/constants";

function applyReducedMotionPreference() {
  const stored = localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reduce = stored === "true" || (stored !== "false" && prefersReduce);
  document.documentElement.dataset.motion = reduce ? "reduce" : "normal";
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyReducedMotionPreference();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => applyReducedMotionPreference();
    mq.addEventListener("change", onChange);

    const onStorage = (event: StorageEvent) => {
      if (event.key === REDUCED_MOTION_STORAGE_KEY) {
        applyReducedMotionPreference();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return children;
}
