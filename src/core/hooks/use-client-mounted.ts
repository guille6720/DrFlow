"use client";

import { useSyncExternalStore } from "react";

/** SSR-safe: false en servidor, true tras hidratar en cliente. */
export function useClientMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
