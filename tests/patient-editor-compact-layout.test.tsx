import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Header } from "@/core/components/layout/header";

import { PatientEhrDemographics } from "@/features/historias/components/historias/patient-ehr-demographics";
import { PatientEhrFiltersBar } from "@/features/historias/components/historias/patient-ehr-filters-bar";
import { DEFAULT_PATIENT_EHR_FILTERS, type PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";

vi.mock("@/core/components/theme/ui-theme-provider", () => ({ useUiThemeOptional: () => null }));
vi.mock("@/core/components/command-palette/command-palette-trigger", () => ({
  CommandPaletteTrigger: () => <button aria-label="Abrir busqueda global">Buscar</button>,
}));
vi.mock("@/core/components/layout/user-account-modal", () => ({ UserAccountModal: () => null }));
vi.mock("@/core/components/layout/clinic-selector", () => ({ ClinicSelector: () => null }));
vi.mock("@/features/pacientes/components/pacientes/patient-whatsapp-button", () => ({ PatientWhatsAppButton: () => null }));

afterEach(() => cleanup());

const patient: PatientEhrPatientInfo = {
  id: "synthetic-patient", first_name: "RENAPDIS", last_name: "TEST A",
  document_number: "RENAPDIS-TEST-A-001", birth_date: null,
  age_label: "26 años", insurance_provider: "TEST", insurance_number: "TEST-001",
  phone: null, email: "test@example.invalid",
};

describe("compact patient identity", () => {
  it("keeps patient identity visible while account tools start collapsed", () => {
    const { container } = render(<Header compact title="RENAPDIS TEST A" subtitle="Documento RENAPDIS-TEST-A-001" meta={<span>26 años</span>} clinics={[]} role="clinic_admin" userName="PROFESIONAL TEST" />);
    expect(screen.getByRole("heading", { name: "RENAPDIS TEST A" })).toBeVisible();
    expect(screen.getByText("Documento RENAPDIS-TEST-A-001")).toBeVisible();
    expect(screen.getByText("26 años")).toBeVisible();
    expect(container.querySelector(".nexclinic-header-tools")).not.toHaveAttribute("open");
    expect(screen.getByText("PROFESIONAL TEST")).not.toBeVisible();
    expect(container.querySelector("summary")).toHaveAttribute("aria-label", "Cuenta y herramientas");
  });

  it("preserves the ordinary header layout for all other pages", () => {
    const { container } = render(<Header title="Pacientes" clinics={[]} role="clinic_admin" userName="PROFESIONAL TEST" />);
    expect(container.querySelector("header")).not.toHaveClass("nexclinic-patient-header-compact");
    expect(container.querySelector("details")).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Abrir mi cuenta" })).toBeVisible();
  });

  it("folds duplicated demographics without deleting contact or coverage information", () => {
    const { container } = render(<PatientEhrDemographics compact patient={patient} totalConsultations={1} />);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Datos del paciente")).toBeVisible();
    expect(screen.getByText(patient.document_number)).not.toBeVisible();
    expect(screen.getByText("TEST-001")).toBeInTheDocument();
    expect(screen.getByText("test@example.invalid")).toBeInTheDocument();
  });

  it("does not fold demographics in the standalone consultation", () => {
    const { container } = render(<PatientEhrDemographics patient={patient} totalConsultations={1} />);
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByText(patient.document_number)).toBeVisible();
  });
});

describe("compact history filters", () => {
  it("keeps prescribing and printing available outside the collapsed filters", () => {
    const { container } = render(<PatientEhrFiltersBar compact filters={DEFAULT_PATIENT_EHR_FILTERS} onToggleFilter={vi.fn()} totalConsultations={1} trailingActions={<a href="https://cup.pami.org.ar/controllers/loginController.php">Receta PAMI</a>} />);
    expect(screen.getByText("Filtros (6)")).toBeVisible();
    expect(screen.getByRole("link", { name: "Receta PAMI" })).toBeVisible();
    expect(screen.getByRole("link").closest("details")).toBeNull();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(6);
  });

  it("shows the selected count and preserves the toggle callback", () => {
    const onToggleFilter = vi.fn();
    render(<PatientEhrFiltersBar compact filters={{ ...DEFAULT_PATIENT_EHR_FILTERS, files: false }} onToggleFilter={onToggleFilter} totalConsultations={1} />);
    expect(screen.getByText("Filtros (5)")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Archivos"));
    expect(onToggleFilter).toHaveBeenCalledExactlyOnceWith("files");
  });

  it("keeps all filter checkboxes visible in the standalone consultation", () => {
    render(<PatientEhrFiltersBar filters={DEFAULT_PATIENT_EHR_FILTERS} onToggleFilter={vi.fn()} totalConsultations={1} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.getByLabelText("Evoluciones")).toBeVisible();
  });

  it("retains the partial HCE import warning", () => {
    render(<PatientEhrFiltersBar compact usesHceExport filters={DEFAULT_PATIENT_EHR_FILTERS} onToggleFilter={vi.fn()} totalConsultations={0} />);
    expect(screen.getByText(/Datos parciales del export HCE/)).toBeVisible();
  });
});

describe("compact header hydration", () => {
  it("hydrates native disclosures in the same collapsed state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const ui = <><Header compact title="RENAPDIS TEST A" clinics={[]} role="doctor" /><PatientEhrDemographics compact patient={patient} /></>;
    container.innerHTML = renderToString(ui);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, ui, { onRecoverableError }); });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.querySelectorAll("details[open]")).toHaveLength(0);
      expect(container.querySelectorAll("summary")).toHaveLength(2);
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});
