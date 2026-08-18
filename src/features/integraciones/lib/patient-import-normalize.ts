import { normalizeDni } from "@/lib/utils/normalize-dni";

const BOOLEAN_TRUE = new Set(["si", "sí", "true", "1", "yes", "y"]);
const BOOLEAN_FALSE = new Set(["no", "false", "0", "n"]);

export function trimImportValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).replace(/\u0000/g, "").trim();
}

export function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[^\d+]/g, "");
  return compact || null;
}

export function normalizeBooleanFlag(value: string): boolean | null {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  if (BOOLEAN_TRUE.has(key)) return true;
  if (BOOLEAN_FALSE.has(key)) return false;
  return null;
}

/** Excel serial date (days since 1899-12-30) → ISO date. */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function normalizeBirthDate(value: string, dateFormat?: string | null): string | null {
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const asNumber = Number(raw.replace(",", "."));
  if (raw !== "" && Number.isFinite(asNumber) && asNumber > 20000 && asNumber < 80000 && !raw.includes("/")) {
    return excelSerialToIsoDate(asNumber);
  }

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += year >= 30 ? 1900 : 2000;
    const preferDmy = dateFormat !== "mdy";
    const dd = preferDmy ? day : month;
    const mm = preferDmy ? month : day;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const iso = `${String(year).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return iso;
  }

  return null;
}

export function normalizeDocumentNumber(value: string): string | null {
  return normalizeDni(value, { trimNineDigit: true });
}

export type NormalizedPatientImportRow = {
  lineNumber: number;
  document_number: string | null;
  last_name: string;
  first_name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  insurance_provider: string | null;
  insurance_plan: string | null;
  insurance_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

export function titleCaseName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
