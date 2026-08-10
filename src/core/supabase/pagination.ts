/** Shared pagination helpers for Supabase list queries. */

export const PACIENTES_PAGE_SIZE = 20;
export const HISTORIAS_PAGE_SIZE = 25;
export const ATENCIONES_PAGE_SIZE = 50;
export const PAMI_PATIENTS_PAGE_SIZE = 50;
export const PATIENT_PICKER_INITIAL_LIMIT = 80;
export const PATIENT_SEARCH_API_LIMIT = 20;
export const APPOINTMENTS_AGENDA_MAX = 1000;
export const PATIENT_ATTACHMENTS_LIMIT = 200;

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** Parses 1-based page from URL search params. */
export function parsePageParam(raw: string | undefined, defaultPage = 1): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return defaultPage;
  return Math.floor(n);
}

/** Inclusive range for Supabase `.range(from, to)`. */
export function offsetRange(page: number, pageSize: number): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function buildPageMeta(total: number, page: number, pageSize: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page: Math.min(Math.max(1, page), totalPages),
    pageSize,
    total,
    totalPages,
  };
}

/** Cursor tuple for keyset pagination on `(sortColumn DESC, id DESC)`. */
export type DescCursor = {
  sortValue: string;
  id: string;
};

export function parseDescCursor(raw: string | undefined): DescCursor | null {
  if (!raw?.trim()) return null;
  const sep = raw.indexOf("|");
  if (sep <= 0) return null;
  const sortValue = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  if (!sortValue || !id) return null;
  return { sortValue, id };
}

export function encodeDescCursor(sortValue: string, id: string): string {
  return `${sortValue}|${id}`;
}
