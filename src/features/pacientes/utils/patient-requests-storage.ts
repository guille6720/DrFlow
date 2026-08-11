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

/** Local cache for WhatsApp intents only — web turnos load from server by DNI. */
const whatsappRequestsKey = (slug: string) => `drflow-solicitudes-${slug}`;
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
  return readJson<PatientRequestRecord[]>(whatsappRequestsKey(slug), []);
}

/** WhatsApp-only requests cached on device until the patient opens chat. */
export function getWhatsappPatientRequests(slug: string): PatientRequestRecord[] {
  return getPatientRequests(slug).filter((record) => record.channel === "whatsapp");
}

export function addPatientRequest(
  slug: string,
  record: Omit<PatientRequestRecord, "localId" | "createdAt"> & {
    localId?: string;
    createdAt?: string;
  }
): PatientRequestRecord {
  if (record.channel !== "whatsapp") {
    throw new Error("Only WhatsApp patient requests are stored locally.");
  }

  const entry: PatientRequestRecord = {
    ...record,
    localId: record.localId ?? crypto.randomUUID(),
    createdAt: record.createdAt ?? new Date().toISOString(),
  };

  const existing = getWhatsappPatientRequests(slug);
  writeJson(whatsappRequestsKey(slug), [entry, ...existing].slice(0, 20));
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
