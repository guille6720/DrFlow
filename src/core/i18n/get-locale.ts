import type { LocaleId } from "@/core/i18n/types";

export const DEFAULT_LOCALE: LocaleId = "es-AR";

/** Returns the active locale. Hook-ready for future user/clinic preference. */
export function getDefaultLocale(): LocaleId {
  return DEFAULT_LOCALE;
}
