import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePatientChartMedicationFilter } from "@/features/pacientes/hooks/use-patient-chart-medication-filter";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

const baseChart = {
  medications: [
    {
      id: "1",
      name: "Enalapril",
      dose: "10mg",
      frequency: "1/día",
      sinceLabel: "2024",
      lastRenewalLabel: "2025",
      raw: { name: "Enalapril", dose: "10mg", frequency: "1/día" },
    },
    {
      id: "2",
      name: "Metformina",
      dose: "850mg",
      frequency: "2/día",
      sinceLabel: "2023",
      lastRenewalLabel: "2025",
      raw: { name: "Metformina", dose: "850mg", frequency: "2/día" },
    },
  ],
} as Pick<PatientChartPayload, "medications">;

describe("usePatientChartMedicationFilter", () => {
  it("returns all medications when search is empty", () => {
    const { result } = renderHook(() =>
      usePatientChartMedicationFilter(baseChart as PatientChartPayload)
    );
    expect(result.current.filteredMeds).toHaveLength(2);
  });

  it("filters medications by search term", async () => {
    const { result } = renderHook(() =>
      usePatientChartMedicationFilter(baseChart as PatientChartPayload)
    );
    act(() => result.current.setMedSearch("metformina"));
    await waitFor(() => {
      expect(result.current.filteredMeds).toHaveLength(1);
    });
    expect(result.current.filteredMeds[0]?.name).toBe("Metformina");
  });
});
