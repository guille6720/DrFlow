import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, PropsWithChildren } from "react";
import { expect, it, vi } from "vitest";

import { DrappTreatmentQuickForm } from "@/features/historias/components/consultas/drapp-treatment-quick-form";
import { saveQuickTreatment } from "@/features/historias/utils/create-quick-clinical-entry";
import { persistClinicalRecordRequest } from "@/features/historias/utils/persist-clinical-record-request";

import type { PrescriptionMedication } from "@/types/prescription";

vi.mock("@/features/historias/components/historias/clinical-favorites-provider", () => ({
  ClinicalFavoritesProvider: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@/features/historias/components/historias/clinical-treatment-autocomplete", () => ({
  ClinicalTreatmentAutocomplete: () => null,
}));
vi.mock("@/features/historias/components/historias/medication-autocomplete", () => ({
  MedicationAutocomplete: ({ onMedicationsChange }: {
    onMedicationsChange: (medications: PrescriptionMedication[]) => void;
  }) => (
    <button type="button" onClick={() => onMedicationsChange([
      { generic_name: "Enalapril", dose: "5 mg", quantity: 1, posology: "1/día" },
      {
        generic_name: "Amlodipina",
        dose: "10 mg",
        quantity: 1,
        posology: "1/día",
        instructions: "Por la mañana",
      },
    ])}>
      Seleccionar medicamentos
    </button>
  ),
}));
vi.mock("@/features/historias/utils/persist-clinical-record-request", () => ({
  persistClinicalRecordRequest: vi.fn(),
}));

it("saves the edited medication once and retains the other selection", async () => {
  const persist = vi.mocked(persistClinicalRecordRequest);
  persist.mockResolvedValue({ success: true, data: { id: "record" } });
  const onSave = vi.fn<ComponentProps<typeof DrappTreatmentQuickForm>["onSave"]>(
    async (treatment, additionalMedications) => {
      await saveQuickTreatment(
        { patientId: "patient", professionalId: "professional", professionalName: "Profesional" },
        treatment,
        additionalMedications
      );
    }
  );
  render(<DrappTreatmentQuickForm onDirtyChange={vi.fn()} onCancel={vi.fn()} onSave={onSave} saving={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Seleccionar medicamentos" }));
  fireEvent.change(screen.getByLabelText("Dosis"), { target: { value: "2.5 mg" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

  const payload = persist.mock.calls[0][0];
  expect(JSON.parse(payload.treatments_json ?? "[]")).toEqual([
    expect.objectContaining({ product: "Amlodipina", dose: "2.5 mg", notes: expect.stringContaining("Por la mañana") }),
    expect.objectContaining({ product: "Enalapril", dose: "5 mg" }),
  ]);
  expect(payload.indications?.match(/Amlodipina/g)).toHaveLength(1);
  await onSave.mock.results[0].value;
});
