"use client";

import { getPamiMessages } from "@/features/pami/i18n/get-pami-messages";

/** Client hook for PAMI UI strings — ready for locale context. */
export function usePamiMessages() {
  return getPamiMessages();
}
