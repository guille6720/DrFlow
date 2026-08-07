import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { PamiPatientsEmptyState } from "@/features/pami/components/pami/pami-patients-empty-state";
import { PamiPlanillaCategorySection } from "@/features/pami/components/pami/pami-planilla-sections";
import { PAMI_PLANILLA_FALLBACK_CATALOG } from "@/features/pami/seed/pami-planilla-fallback-catalog";

vi.mock("@/core/hooks/use-async-patient-search", () => ({
  useAsyncPatientSearch: () => ({ results: [], loading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("PAMI accessibility", () => {
  it("category section exposes radiogroup with roving tabindex", () => {
    const selectCategory = vi.fn();
    const view = render(
      <PamiPlanillaCategorySection
        categories={PAMI_PLANILLA_FALLBACK_CATALOG.categories}
        category={PAMI_PLANILLA_FALLBACK_CATALOG.categories[0]!.id}
        selectCategory={selectCategory}
      />
    );

    const group = within(view.container).getByRole("radiogroup", {
      name: /tipo de solicitud pami/i,
    });
    const radios = within(group).getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(1);
    expect(radios.some((radio) => radio.getAttribute("tabindex") === "0")).toBe(true);
  });

  it("category section supports arrow key navigation", () => {
    const selectCategory = vi.fn();
    const view = render(
      <PamiPlanillaCategorySection
        categories={PAMI_PLANILLA_FALLBACK_CATALOG.categories}
        category={PAMI_PLANILLA_FALLBACK_CATALOG.categories[0]!.id}
        selectCategory={selectCategory}
      />
    );

    const group = within(view.container).getByRole("radiogroup", {
      name: /tipo de solicitud pami/i,
    });
    const radios = within(group).getAllByRole("radio");
    radios[0]?.focus();
    fireEvent.keyDown(radios[0]!, { key: "ArrowRight" });

    expect(selectCategory).toHaveBeenCalledWith(PAMI_PLANILLA_FALLBACK_CATALOG.categories[1]!.id);
  });

  it("empty state exposes labelled section and accessible links", () => {
    render(<PamiPatientsEmptyState />);

    expect(screen.getByRole("heading", { name: /no hay pacientes pami/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /crear paciente pami/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /importar pacientes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /actualizar listado/i })).toBeInTheDocument();
  });

  it("patient combobox supports combobox semantics and escape to close", () => {
    render(
      <PatientSearchCombobox
        label="Paciente PAMI"
        patients={[
          {
            id: "p1",
            first_name: "Juan",
            last_name: "García",
            document_number: "12345678",
          },
        ]}
        searchMode="local"
        cobertura="pami"
      />
    );

    const combobox = screen.getByRole("combobox", { name: /paciente pami/i });
    expect(combobox).toHaveAttribute("aria-expanded", "false");

    fireEvent.focus(combobox);
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: /resultados de paciente pami/i })).toBeInTheDocument();

    fireEvent.keyDown(combobox, { key: "Escape" });
    expect(combobox).toHaveAttribute("aria-expanded", "false");
  });
});
