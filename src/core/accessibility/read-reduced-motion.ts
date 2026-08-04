import { REDUCED_MOTION_STORAGE_KEY } from "@/core/accessibility/constants";

/** Lee preferencia de movimiento reducido (SSR-safe). */
export function readReducedMotionPreference(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return stored === "true" || (stored !== "false" && prefersReduce);
}
