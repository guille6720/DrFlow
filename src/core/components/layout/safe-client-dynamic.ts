import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/** Avoid crashing the dashboard when a lazy chunk fails after deploy. */
export function safeClientDynamic<T extends ComponentType<object>>(
  loader: () => Promise<{ default: T }>
) {
  const Null = (() => null) as unknown as T;
  return dynamic(() => loader().catch(() => ({ default: Null })), { ssr: false });
}
