import { describe, expect, it } from "vitest";
import {
  buildClinicalTimeline,
  classifyAttachmentTimelineType,
  filterClinicalTimelineEvents,
  groupClinicalTimelineByMonth,
} from "@/lib/utils/build-clinical-timeline";
import type { ClinicalTimelineInput } from "@/lib/utils/build-clinical-timeline";

const baseInput: ClinicalTimelineInput = {
  patientId: "pat-1",
  consultations: [
    {
      id: "rec-1",
      created_at: "2025-03-15T10:00:00.000Z",
      professional_name: "Dr. López",
      chief_complaint: "Control HTA",
      diagnosis: "Hipertensión arterial",
      evolution: "Estable",
      indications: "",
      category: "evolution",
    },
    {
      id: "rec-2",
      created_at: "2025-02-01T09:00:00.000Z",
      professional_name: "Dr. López",
      chief_complaint: "Alta médica post internación",
      diagnosis: "EPOC compensado",
      evolution: "Egreso hospitalario",
      indications: "",
      category: "evolution",
    },
  ],
  attachments: [
    {
      id: "att-1",
      file_name: "hemograma_completo.pdf",
      created_at: "2025-03-14T08:00:00.000Z",
      category: "estudio",
    },
    {
      id: "att-2",
      file_name: "rx_torax.dcm",
      created_at: "2025-03-13T08:00:00.000Z",
      category: null,
    },
  ],
  prescriptions: [
    {
      id: "rx-1",
      created_at: "2025-03-15T11:00:00.000Z",
      issued_at: "2025-03-15T11:30:00.000Z",
      label: "Receta · Enalapril",
      status: "issued",
    },
    {
      id: "rx-2",
      created_at: "2025-03-10T11:00:00.000Z",
      issued_at: null,
      label: "Receta borrador",
      status: "draft",
    },
  ],
  orders: [
    {
      id: "ord-1",
      clinic_id: "c1",
      patient_id: "pat-1",
      clinical_record_id: "rec-1",
      professional_id: "p1",
      order_text: "Laboratorio completo",
      notes: null,
      status: "issued",
      issued_at: "2025-03-14T12:00:00.000Z",
      created_by: "u1",
      created_at: "2025-03-14T12:00:00.000Z",
      updated_at: "2025-03-14T12:00:00.000Z",
      order_type: "study",
    },
    {
      id: "ord-2",
      clinic_id: "c1",
      patient_id: "pat-1",
      clinical_record_id: null,
      professional_id: "p1",
      order_text: "Cardiología",
      notes: null,
      status: "issued",
      issued_at: "2025-03-12T12:00:00.000Z",
      created_by: "u1",
      created_at: "2025-03-12T12:00:00.000Z",
      updated_at: "2025-03-12T12:00:00.000Z",
      order_type: "referral",
    },
  ],
  appointments: [
    {
      id: "appt-1",
      start_at: "2025-03-15T09:30:00.000Z",
      status: "attended",
      professional_name: "Dr. López",
    },
    {
      id: "appt-2",
      start_at: "2025-02-20T09:30:00.000Z",
      status: "no_show",
      professional_name: "Dr. López",
    },
  ],
};

describe("classifyAttachmentTimelineType", () => {
  it("classifies imaging files", () => {
    expect(classifyAttachmentTimelineType("rx_torax.pdf", null)).toBe("imaging");
  });

  it("classifies lab files and estudio category", () => {
    expect(classifyAttachmentTimelineType("informe.pdf", "estudio")).toBe("lab");
    expect(classifyAttachmentTimelineType("hemograma.pdf", null)).toBe("lab");
  });
});

describe("buildClinicalTimeline", () => {
  it("merges and sorts events newest first", () => {
    const events = buildClinicalTimeline(baseInput);
    expect(events.length).toBeGreaterThan(5);
    expect(new Date(events[0].at).getTime()).toBeGreaterThanOrEqual(new Date(events[1].at).getTime());
  });

  it("skips draft prescriptions", () => {
    const events = buildClinicalTimeline(baseInput);
    expect(events.some((e) => e.id === "rx-rx-2")).toBe(false);
    expect(events.some((e) => e.id === "rx-rx-1")).toBe(true);
  });

  it("uses issued_at for prescriptions", () => {
    const events = buildClinicalTimeline(baseInput);
    const rx = events.find((e) => e.id === "rx-rx-1");
    expect(rx?.at).toBe("2025-03-15T11:30:00.000Z");
  });

  it("infers discharge from consultation text", () => {
    const events = buildClinicalTimeline(baseInput);
    expect(events.some((e) => e.type === "discharge")).toBe(true);
  });

  it("links consultations to historia detail", () => {
    const events = buildClinicalTimeline(baseInput);
    const consult = events.find((e) => e.id === "c-rec-1-consultation");
    expect(consult?.href).toBe("/historias/rec-1");
  });

  it("maps referral orders to interconsultas tab", () => {
    const events = buildClinicalTimeline(baseInput);
    const referral = events.find((e) => e.id === "o-ord-2");
    expect(referral?.type).toBe("referral");
    expect(referral?.href).toBe("/pacientes/pat-1?tab=interconsultas");
  });
});

describe("filterClinicalTimelineEvents", () => {
  it("filters by recetas", () => {
    const events = buildClinicalTimeline(baseInput);
    const filtered = filterClinicalTimelineEvents(events, "recetas");
    expect(filtered.every((e) => e.type === "prescription")).toBe(true);
    expect(filtered.length).toBe(1);
  });
});

describe("groupClinicalTimelineByMonth", () => {
  it("groups events by yyyy-MM descending", () => {
    const events = buildClinicalTimeline(baseInput);
    const groups = groupClinicalTimelineByMonth(events);
    expect(groups[0].monthKey >= groups[groups.length - 1].monthKey).toBe(true);
    expect(groups.some((g) => g.monthKey.startsWith("2025-03"))).toBe(true);
  });
});
