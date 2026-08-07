"use client";

import { ToastItem } from "@/core/components/notifications/toast-item";
import { useToastStore } from "@/core/hooks/use-toast-store";

/** Global toast viewport — mount once near the app root. */
export function ToastProvider() {
  const toasts = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notificaciones"
      className="pointer-events-none fixed inset-x-3 top-3 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-full sm:max-w-sm"
    >
      {toasts.map((item) => (
        <ToastItem key={item.id} toast={item} />
      ))}
    </div>
  );
}
