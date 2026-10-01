import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Header } from "@/core/components/layout/header";
import { PrintPageButton } from "@/core/components/ui/print-page-button";

import { PatientEhrSidebar } from "@/features/historias/components/historias/patient-ehr-sidebar";
import { calendarDayKey, formatPatientEhrSidebarDate, formatPatientEhrSidebarTime, isSameCalendarDay } from "@/features/historias/components/historias/patient-ehr-utils";
import { ClinicalWorkspaceLastConsultSection } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-last-consult-section";
import { ClinicalWorkspaceStudiesSection } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-studies-section";
import { ClinicalWorkspaceTimelinePreview } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-timeline-preview";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import { buildLastConsultSummary } from "@/features/pacientes/utils/clinical-workspace-alerts";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

vi.mock("@/core/components/theme/ui-theme-provider", () => ({ useUiThemeOptional: () => null }));
vi.mock("@/core/components/command-palette/command-palette-trigger", () => ({
  CommandPaletteTrigger: () => <button aria-label="Abrir busqueda global">Buscar</button>,
}));
vi.mock("@/core/components/layout/user-account-modal", () => ({ UserAccountModal: () => null }));
vi.mock("@/core/components/layout/clinic-selector", () => ({ ClinicSelector: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const consultation: PatientEhrConsultation = {
  id: "synthetic-consultation", created_at: "2026-10-02T18:05:00Z",
  professional_name: "RENAPDIS TEST", chief_complaint: "", diagnosis: "",
  evolution: "PRUEBA SINTETICA", indications: "", category: "evolution",
};
const ehr: PatientEhrWorkspaceData = {
  patientInfo: {
    id: "synthetic-patient", first_name: "RENAPDIS", last_name: "TEST A",
    document_number: "RENAPDIS-TEST-A-001", document_type: "other", birth_date: null,
    age_label: null, insurance_provider: null, insurance_number: null, phone: null, email: null,
  },
  consultations: [consultation], diagnosisRows: [], treatmentRows: [], problemList: [],
  attachments: [], prescriptions: [], prescriptionRecords: [], orders: [], appointments: [],
  totalConsultations: 1, usesHceExport: false,
  clinicalRecordsPagination: { total: 1, hasMore: false, nextCursor: null },
};

function ConsultationSummary() {
  return <ClinicalWorkspaceLastConsultSection summary={buildLastConsultSummary(consultation, [], [])} />;
}

describe("patient workspace server/client dates", () => {
  it.each(["UTC", "America/Argentina/Buenos_Aires", "Asia/Tokyo"])("keeps clinic hours under host timezone %s", (timezone) => {
    vi.stubEnv("TZ", timezone);
    expect(buildLastConsultSummary(consultation, [], [])?.dateLabel).toBe("2 de oct de 2026, 15:05");
  });

  it("keeps the clinic calendar day around UTC midnight", () => {
    const summary = buildLastConsultSummary({ ...consultation, created_at: "2026-10-02T01:05:00Z" }, [], []);
    expect(summary?.dateLabel).toBe("1 de oct de 2026, 22:05");
  });

  it("handles missing and invalid consultations without unstable text", () => {
    expect(buildLastConsultSummary(undefined, [], [])).toBeNull();
    expect(buildLastConsultSummary({ ...consultation, created_at: "invalid" }, [], [])?.dateLabel).toBe("—");
  });

  it("formats timeline timestamps in the clinic timezone", () => {
    render(<ClinicalWorkspaceTimelinePreview ehr={ehr} patientId={ehr.patientInfo.id} />);
    expect(screen.getByText("2 oct 2026 15:05")).toBeInTheDocument();
  });

  it("formats study dates in the clinic timezone", () => {
    const chart = { studies: [{ id: "synthetic-file", file_name: "PRUEBA.txt", created_at: "2026-10-02T01:05:00Z", category: null }] } as PatientChartPayload;
    render(<ClinicalWorkspaceStudiesSection chart={chart} patientId={ehr.patientInfo.id} />);
    expect(screen.getByText(/1 oct 2026/)).toBeInTheDocument();
  });

  it.each([ConsultationSummary, () => <ClinicalWorkspaceTimelinePreview ehr={ehr} patientId={ehr.patientInfo.id} />])("hydrates stable text across different host zones", async (Component) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    vi.stubEnv("TZ", "UTC");
    container.innerHTML = renderToString(<Component />);
    const serverText = container.textContent;
    vi.stubEnv("TZ", "America/Argentina/Buenos_Aires");
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, <Component />, { onRecoverableError }); });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.textContent).toBe(serverText);
      expect(container.textContent).toContain("15:05");
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});

describe("clinical history sidebar dates", () => {
  it.each(["UTC", "America/Argentina/Buenos_Aires", "Asia/Tokyo"])("uses the clinic day and hour under host timezone %s", (timezone) => {
    vi.stubEnv("TZ", timezone);
    expect(formatPatientEhrSidebarTime(consultation.created_at)).toBe("15:05");
    expect(formatPatientEhrSidebarDate("2026-10-02T01:05:00Z")).toBe("1-OCT-26");
    expect(calendarDayKey("2026-10-02T01:05:00Z")).toBe("2026-10-01");
    expect(isSameCalendarDay("2026-10-02T01:05:00Z", "2026-10-01T18:05:00Z")).toBe(true);
    expect(isSameCalendarDay("2026-10-02T01:05:00Z", "2026-10-02T04:05:00Z")).toBe(false);
  });

  it("hydrates clinical history sidebar day and saved hour across host zones", async () => {
    const midnightConsultation = { ...consultation, created_at: "2026-10-02T01:05:00Z" };
    function HistorySidebar() {
      return <><PatientEhrSidebar sidebarList={[midnightConsultation]} selectedId={null} onSelect={() => {}} /><span>{formatPatientEhrSidebarTime(consultation.created_at)}</span></>;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    vi.stubEnv("TZ", "UTC");
    container.innerHTML = renderToString(<HistorySidebar />);
    const serverText = container.textContent;
    vi.stubEnv("TZ", "America/Argentina/Buenos_Aires");
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, <HistorySidebar />, { onRecoverableError }); });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.textContent).toBe(serverText);
      expect(container.textContent).toContain("1-OCT-26");
      expect(container.textContent).toContain("15:05");
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });

  it("returns stable placeholders for invalid history timestamps", () => {
    expect(formatPatientEhrSidebarDate("invalid")).toBe("—");
    expect(formatPatientEhrSidebarTime("invalid")).toBe("—");
    expect(isSameCalendarDay("invalid", consultation.created_at)).toBe(false);
  });
});

describe("print control markup and behavior", () => {
  it.each(["button", "link"] as const)("renders one interactive element for %s variant", (variant) => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<PrintPageButton variant={variant} />);
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector("button button")).toBeNull();
    expect(container.textContent).toBe("Imprimir");
  });

  it("hydrates the parsed server markup without recovering the tree", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(<PrintPageButton />);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, <PrintPageButton />, { onRecoverableError }); });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.querySelectorAll("button")).toHaveLength(1);
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });

  it("prints once and preserves custom content", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<PrintPageButton><span>Imprimir prueba</span></PrintPageButton>);
    fireEvent.click(screen.getByRole("button", { name: "Imprimir prueba" }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe("header identity layout", () => {
  it("does not reserve a second desktop sidebar and keeps identity together", () => {
    const { container } = render(<Header title="RENAPDIS PACIENTE TEST A" subtitle="Documento RENAPDIS-TEST-A-001" meta={<dl><dt>Nacimiento</dt><dd>01/01/2000</dd></dl>} clinics={[]} role="clinic_admin" userName="RENAPDIS PROFESIONAL TEST A" />);
    const header = container.querySelector("header")!;
    expect(header.className).not.toContain("lg:pl-72");
    expect(screen.getByRole("heading").parentElement).toContainElement(screen.getByText("Nacimiento"));
    expect(screen.getByRole("button", { name: "Abrir mi cuenta" })).toBeInTheDocument();
  });
});
