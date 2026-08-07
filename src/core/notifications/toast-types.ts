export type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
  /** Reuse an id to replace an existing toast. */
  id?: string;
  /** Auto-dismiss delay in ms. `0` keeps the toast until manual dismiss. */
  duration?: number;
  /** Show the close button. Defaults to true. */
  dismissible?: boolean;
};

export type ToastRecord = {
  id: string;
  tone: ToastTone;
  message: string;
  duration: number;
  dismissible: boolean;
  createdAt: number;
};

export const DEFAULT_TOAST_DURATION_MS = 5000;
export const MAX_VISIBLE_TOASTS = 5;
