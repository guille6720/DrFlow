"use client";

import { useSyncExternalStore } from "react";

import { getToastsSnapshot, subscribeToasts } from "@/core/notifications/toast-store";

export function useToastStore() {
  return useSyncExternalStore(subscribeToasts, getToastsSnapshot, getToastsSnapshot);
}
