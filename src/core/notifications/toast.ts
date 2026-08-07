import {
  addToast,
  dismissAllToasts,
  dismissToast,
} from "@/core/notifications/toast-store";
import type { ToastOptions } from "@/core/notifications/toast-types";

function show(tone: "success" | "error" | "info", message: string, options?: ToastOptions) {
  return addToast(tone, message, options);
}

/** Imperative toast API — works outside React (hooks, event handlers, services). */
export const toast = {
  success(message: string, options?: ToastOptions) {
    return show("success", message, options);
  },
  error(message: string, options?: ToastOptions) {
    return show("error", message, { duration: 7000, ...options });
  },
  info(message: string, options?: ToastOptions) {
    return show("info", message, options);
  },
  /** Short-lived confirmation after clipboard actions. */
  copySuccess(message = "Copiado al portapapeles", options?: ToastOptions) {
    return show("success", message, { duration: 4000, ...options });
  },
  dismiss(id: string) {
    dismissToast(id);
  },
  dismissAll() {
    dismissAllToasts();
  },
};
