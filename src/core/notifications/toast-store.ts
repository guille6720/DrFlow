import {
  DEFAULT_TOAST_DURATION_MS,
  MAX_VISIBLE_TOASTS,
  type ToastOptions,
  type ToastRecord,
  type ToastTone,
} from "@/core/notifications/toast-types";

type Listener = () => void;

let toasts: ToastRecord[] = [];
const listeners = new Set<Listener>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

let idCounter = 0;

function createToastId(provided?: string): string {
  if (provided) return provided;
  idCounter += 1;
  return `toast-${idCounter}-${Date.now()}`;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function clearDismissTimer(id: string) {
  const timer = dismissTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
}

function scheduleDismiss(id: string, duration: number) {
  clearDismissTimer(id);
  if (duration <= 0) return;

  const timer = setTimeout(() => {
    dismissToast(id);
  }, duration);
  dismissTimers.set(id, timer);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToastsSnapshot(): readonly ToastRecord[] {
  return toasts;
}

export function addToast(tone: ToastTone, message: string, options: ToastOptions = {}): string {
  const id = createToastId(options.id);
  const duration = options.duration ?? DEFAULT_TOAST_DURATION_MS;
  const dismissible = options.dismissible ?? true;

  const next: ToastRecord = {
    id,
    tone,
    message,
    duration,
    dismissible,
    createdAt: Date.now(),
  };

  const withoutDuplicate = toasts.filter((toast) => toast.id !== id);
  toasts = [...withoutDuplicate, next].slice(-MAX_VISIBLE_TOASTS);
  emit();
  scheduleDismiss(id, duration);
  return id;
}

export function dismissToast(id: string) {
  clearDismissTimer(id);
  const next = toasts.filter((toast) => toast.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function dismissAllToasts() {
  dismissTimers.forEach((timer) => clearTimeout(timer));
  dismissTimers.clear();
  if (toasts.length === 0) return;
  toasts = [];
  emit();
}

/** Test helper — resets module state between unit tests. */
export function resetToastStoreForTests() {
  dismissAllToasts();
  idCounter = 0;
}
