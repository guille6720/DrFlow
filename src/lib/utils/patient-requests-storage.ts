export type PatientRequestChannel = "web" | "whatsapp";
export type PatientRequestType = "turno" | "receta" | "consulta";

export interface PatientRequestRecord {
  localId: string;
  appointmentId?: string;
  type: PatientRequestType;
  channel: PatientRequestChannel;
  documentNumber: string;
  patientName: string;
  startAt?: string;
  createdAt: string;
}

const requestsKey = (slug: string) => `drflow-solicitudes-${slug}`;
const dniKey = (slug: string) => `drflow-dni-${slug}`;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage lleno o bloqueado */
  }
}

export function getStoredDocument(slug: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(dniKey(slug)) ?? "";
  } catch {
    return "";
  }
}

export function setStoredDocument(slug: string, documentNumber: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(dniKey(slug), documentNumber.trim());
  } catch {
    /* ignore */
  }
}

export function getPatientRequests(slug: string): PatientRequestRecord[] {
  return readJson<PatientRequestRecord[]>(requestsKey(slug), []);
}

export function addPatientRequest(
  slug: string,
  record: Omit<PatientRequestRecord, "localId" | "createdAt"> & {
    localId?: string;
    createdAt?: string;
  }
): PatientRequestRecord {
  const entry: PatientRequestRecord = {
    ...record,
    localId: record.localId ?? crypto.randomUUID(),
    createdAt: record.createdAt ?? new Date().toISOString(),
  };

  const existing = getPatientRequests(slug).filter(
    (r) =>
      !(
        record.appointmentId &&
        r.appointmentId === record.appointmentId
      )
  );
  writeJson(requestsKey(slug), [entry, ...existing].slice(0, 20));
  setStoredDocument(slug, record.documentNumber);
  return entry;
}

export function requestTypeLabel(type: PatientRequestType): string {
  if (type === "turno") return "Turno";
  if (type === "receta") return "Receta";
  return "Consulta";
}

export function requestChannelLabel(channel: PatientRequestChannel): string {
  return channel === "web" ? "Web" : "WhatsApp";
}
