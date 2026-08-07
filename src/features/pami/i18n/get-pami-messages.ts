import { getDefaultLocale } from "@/core/i18n";

import { type PamiMessages, pamiMessagesEsAr } from "@/locales/es-AR/pami";

const localeCatalog: Record<string, PamiMessages> = {
  "es-AR": pamiMessagesEsAr,
};

/** Returns PAMI messages for the given locale (defaults to clinic locale). */
export function getPamiMessages(locale = getDefaultLocale()): PamiMessages {
  return localeCatalog[locale] ?? pamiMessagesEsAr;
}

export type { PamiMessages };
