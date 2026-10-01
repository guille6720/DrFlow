import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { formatLabeledPatientDocument, formatPatientDocument, patientDocumentLabel } from "@/shared/utils/patient-display";

import { CalendarGrid } from "@/features/agenda/components/agenda/calendar-grid";
import { PatientEhrDemographics } from "@/features/historias/components/historias/patient-ehr-demographics";
import { PatientEhrPrintDemographics } from "@/features/historias/components/historias/patient-ehr-print-demographics";
import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";
import { buildEhrPrintDocumentHtml } from "@/features/historias/utils/build-ehr-print-document-html";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { searchPatientsForClinic } from "@/features/pacientes/server/search-patients";

vi.mock("@/core/hooks/use-async-patient-search", () => ({
  useAsyncPatientSearch: () => ({ results: [], loading: false, error: null }),
}));

afterEach(cleanup);

const patient: PatientEhrPatientInfo = {
  id: "synthetic-a", first_name: "RENAPDIS", last_name: "PACIENTE TEST A",
  document_number: "RENAPDIS-TEST-A-001", document_type: "other",
  birth_date: "2000-01-01", age_label: "26", insurance_provider: null,
  insurance_number: null, phone: null, email: null,
};

describe("patient document labels", () => {
  it.each([
    ["dni", "DNI"], [" DNI ", "DNI"], ["passport", "Pasaporte"],
    ["cuit", "CUIT"], ["cdi", "CDI"], ["other", "Documento"],
    [null, "Documento"], [undefined, "Documento"], ["", "Documento"],
    ["unrecognized", "Documento"],
  ])("labels %s as %s without guessing identity", (type, label) => {
    expect(patientDocumentLabel(type)).toBe(label);
  });

  it("preserves legacy number formatting and omits empty identifiers", () => {
    expect(formatPatientDocument(" 00123 ")).toBe("00123");
    expect(formatLabeledPatientDocument(patient)).toBe("Documento RENAPDIS-TEST-A-001");
    expect(formatLabeledPatientDocument({ document_type: "dni", document_number: " " })).toBeNull();
  });

  it.each(["compact", "detailed"] as const)("shows typed identifiers in %s search results", (displayMode) => {
    render(<PatientSearchCombobox patients={[patient]} searchMode="local" displayMode={displayMode} />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByRole("option")).toHaveTextContent("Documento RENAPDIS-TEST-A-001");
    expect(screen.getByRole("option")).not.toHaveTextContent("DNI RENAPDIS");
  });

  it.each([PatientEhrDemographics, PatientEhrPrintDemographics])("uses the same label on screen and print", (Component) => {
    const view = render(<Component patient={patient} />);
    expect(screen.getByText("Documento", { exact: true })).toBeInTheDocument();
    expect(view.container).not.toHaveTextContent("DNI");
  });

  it.each(["other", "passport", "dni"])("keeps %s identity in the generated print document", (document_type) => {
    const html = buildEhrPrintDocumentHtml({
      scope: "all", patient: { ...patient, document_type }, consultations: [],
      dayConsultations: [], diagnosisRows: [], treatmentRows: [],
    });
    expect(html).toContain(patientDocumentLabel(document_type));
    if (document_type !== "dni") expect(html).not.toContain("DNI");
  });

  it.each([false, true])("keeps the typed identity on agenda cards and tooltips (array=%s)", (array) => {
    const start = new Date(2026, 9, 2, 9);
    const appointment: AppointmentAgendaRow = {
      id: "synthetic-appointment", clinic_id: "test-a", patient_id: patient.id,
      professional_id: "synthetic-professional", location_id: null, specialty_id: null,
      start_at: start.toISOString(), end_at: new Date(2026, 9, 2, 9, 30).toISOString(),
      status: "pending", notes: null, cancellation_reason: null, cancelled_at: null,
      cancelled_by: null, cancelled_by_type: null, patients: array ? [patient] : patient,
    };
    const view = render(<CalendarGrid weekDays={[start]} appointments={[appointment]} />);
    expect(screen.getByText("Documento RENAPDIS-TEST-A-001")).toBeInTheDocument();
    expect(view.container.querySelector('[title*="Documento RENAPDIS-TEST-A-001"]')).not.toBeNull();
    expect(view.container).not.toHaveTextContent("DNI");
  });
});

function searchClient(identities: unknown[], identityError: { message: string } | null = null) {
  const inIds = vi.fn().mockResolvedValue({ data: identities, error: identityError });
  const eq = vi.fn().mockReturnValue({ in: inIds });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({ data: [{ ...patient, document_type: undefined }], error: null });
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from, select, eq, inIds };
}

describe("RLS-scoped search identity enrichment", () => {
  it("adds the stored type using the same client, clinic and bounded result IDs", async () => {
    const db = searchClient([{ id: patient.id, document_type: "other" }]);
    const result = await searchPatientsForClinic(db.client, { clinicId: "test-a", q: "RENAPDIS" });
    expect(result.patients[0]?.document_type).toBe("other");
    expect(db.from).toHaveBeenCalledWith("patients");
    expect(db.select).toHaveBeenCalledWith("id, document_type");
    expect(db.eq).toHaveBeenCalledWith("clinic_id", "test-a");
    expect(db.inIds).toHaveBeenCalledWith("id", [patient.id]);
  });

  it("does not return patients hidden by RLS even if the search RPC returned them", async () => {
    const db = searchClient([]);
    expect((await searchPatientsForClinic(db.client, { clinicId: "test-a", q: "RENAPDIS" })).patients).toEqual([]);
  });

  it("fails closed when identity lookup is denied", async () => {
    const db = searchClient([], { message: "permission denied" });
    expect(await searchPatientsForClinic(db.client, { clinicId: "test-a", q: "RENAPDIS" }))
      .toEqual({ patients: [], error: "permission denied" });
  });

  it("does not issue an extra query for empty search results", async () => {
    const db = searchClient([]);
    db.rpc.mockResolvedValue({ data: [], error: null });
    expect((await searchPatientsForClinic(db.client, { clinicId: "test-a", q: "RENAPDIS" })).patients).toEqual([]);
    expect(db.from).not.toHaveBeenCalled();
  });
});
