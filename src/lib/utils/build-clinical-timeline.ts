import { orderTypeLabel } from "@/components/recetas/prescriptions-orders-utils";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import type {
  ClinicalTimelineEvent,
  ClinicalTimelineEventType,
  ClinicalTimelineFilterId,
} from "@/lib/utils/clinical-timeline-types";
import { CLINICAL_TIMELINE_FILTER_OPTIONS } from "@/lib/utils/clinical-timeline-types";
import type { PatientEhrConsultation, PatientEhrAttachment } from "@/lib/utils/patient-ehr-model";
import type { MedicalOrder } from "@/types/medical-order";

export type PatientEhrAppointment = {
  id: string;
  start_at: string;
  status: string;
  professional_name: string | null;
};

export type PatientEhrTimelinePrescription = {
  id: string;
  created_at: string;
  issued_at: string | null;
  label: string;
  status: string;
};

export type ClinicalTimelineInput = {
  patientId: string;
  consultations: PatientEhrConsultation[];
  attachments: PatientEhrAttachment[];
  prescriptions: PatientEhrTimelinePrescription[];
  orders: (MedicalOrder & { order_type?: string })[];
  appointments: PatientEhrAppointment[];
};

const HOSPITALIZATION_RE = /internaci[oó]n|ingreso hospital|hospitaliz/i;
const DISCHARGE_RE = /\balta\b|egreso hospital|alta m[eé]dica/i;

const IMAGING_RE = /radiolog|\brx\b|rx[_-]|tomograf|resonan|ecograf|imagen|mamograf|densitometr/i;
const LAB_RE = /lab|laboratorio|analit|hemograma|glucosa|orina|bioqu[ií]m|perfil hep/i;

function consultationEventType(category: PatientEhrConsultation["category"]): ClinicalTimelineEventType {
  if (category === "vitals") return "vitals";
  if (category === "diagnostic") return "diagnostic";
  if (category === "treatment") return "treatment";
  if (category === "document") return "document";
  return "consultation";
}

export function classifyAttachmentTimelineType(
  fileName: string,
  category: string | null
): "lab" | "imaging" | "document" {
  const blob = `${fileName} ${category ?? ""}`.toLowerCase();
  if (IMAGING_RE.test(blob)) return "imaging";
  if (LAB_RE.test(blob) || category === "estudio") return "lab";
  return "document";
}

function orderEventType(orderType?: string): ClinicalTimelineEventType {
  if (orderType === "referral") return "referral";
  if (orderType === "pami_form") return "pami_form";
  return "order";
}

function consultationTitle(c: PatientEhrConsultation): string {
  if (c.category === "vitals") return "Registro de signos vitales";
  if (c.category === "diagnostic") return c.diagnosis?.trim() || "Diagnóstico";
  if (c.category === "treatment") return c.indications?.trim().split("\n")[0] || "Tratamiento";
  if (c.category === "document") return c.chief_complaint?.trim() || "Documento clínico";
  return c.diagnosis?.trim() || c.chief_complaint?.trim() || "Evolución clínica";
}

function combinedConsultationText(c: PatientEhrConsultation): string {
  return [c.chief_complaint, c.diagnosis, c.evolution, c.indications].filter(Boolean).join(" ");
}

function pushInferredCareEvents(
  events: ClinicalTimelineEvent[],
  c: PatientEhrConsultation,
  text: string
) {
  if (HOSPITALIZATION_RE.test(text)) {
    events.push({
      id: `hosp-${c.id}`,
      type: "hospitalization",
      at: c.created_at,
      title: "Internación",
      subtitle: c.diagnosis?.trim() || c.chief_complaint?.trim() || undefined,
      meta: c.professional_name,
      href: `/historias/${c.id}`,
      recordId: c.id,
    });
  }
  if (DISCHARGE_RE.test(text)) {
    events.push({
      id: `dis-${c.id}`,
      type: "discharge",
      at: c.created_at,
      title: "Alta médica",
      subtitle: c.diagnosis?.trim() || c.evolution?.trim() || undefined,
      meta: c.professional_name,
      href: `/historias/${c.id}`,
      recordId: c.id,
    });
  }
}

export function buildClinicalTimeline(input: ClinicalTimelineInput): ClinicalTimelineEvent[] {
  const { patientId } = input;
  const events: ClinicalTimelineEvent[] = [];

  for (const c of input.consultations) {
    const type = consultationEventType(c.category);
    events.push({
      id: `c-${c.id}-${type}`,
      type,
      at: c.created_at,
      title: consultationTitle(c),
      subtitle: c.evolution?.trim() || undefined,
      meta: c.professional_name,
      href: `/historias/${c.id}`,
      recordId: c.id,
    });
    pushInferredCareEvents(events, c, combinedConsultationText(c));
  }

  for (const a of input.attachments) {
    const type = classifyAttachmentTimelineType(a.file_name, a.category);
    const tab = type === "document" ? "archivos" : "estudios";
    events.push({
      id: `att-${a.id}`,
      type,
      at: a.created_at,
      title: a.file_name,
      meta: a.category ?? undefined,
      href: patientWorkspacePath(patientId, tab),
    });
  }

  for (const rx of input.prescriptions) {
    if (rx.status !== "issued" && !rx.issued_at) continue;
    events.push({
      id: `rx-${rx.id}`,
      type: "prescription",
      at: rx.issued_at ?? rx.created_at,
      title: rx.label,
      href: buildPatientWorkspaceUrl(patientId, { tab: "recetas" }),
    });
  }

  for (const order of input.orders) {
    if (order.status === "draft") continue;
    const type = orderEventType(order.order_type);
    events.push({
      id: `o-${order.id}`,
      type,
      at: order.issued_at,
      title: orderTypeLabel(order.order_type),
      subtitle: order.order_text.trim().slice(0, 120) || undefined,
      href:
        type === "referral"
          ? patientWorkspacePath(patientId, "ordenes")
          : buildPatientWorkspaceUrl(patientId, { tab: "ordenes" }),
      recordId: order.clinical_record_id ?? undefined,
    });
  }

  for (const appt of input.appointments) {
    if (appt.status === "attended") {
      events.push({
        id: `appt-${appt.id}`,
        type: "appointment",
        at: appt.start_at,
        title: "Turno atendido",
        meta: appt.professional_name ?? undefined,
        href: "/agenda",
      });
      continue;
    }
    if (appt.status === "no_show") {
      events.push({
        id: `appt-${appt.id}`,
        type: "no_show",
        at: appt.start_at,
        title: "Paciente ausente",
        meta: appt.professional_name ?? undefined,
        href: "/agenda",
      });
    }
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function filterClinicalTimelineEvents(
  events: ClinicalTimelineEvent[],
  filter: ClinicalTimelineFilterId
): ClinicalTimelineEvent[] {
  if (filter === "all") return events;
  const def = CLINICAL_TIMELINE_FILTER_OPTIONS.find((f) => f.id === filter);
  if (!def?.types) return events;
  const allowed = new Set(def.types);
  return events.filter((e) => allowed.has(e.type));
}

export function groupClinicalTimelineByMonth(
  events: ClinicalTimelineEvent[]
): { monthKey: string; events: ClinicalTimelineEvent[] }[] {
  const groups = new Map<string, ClinicalTimelineEvent[]>();
  for (const event of events) {
    const d = new Date(event.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, monthEvents]) => ({ monthKey, events: monthEvents }));
}
