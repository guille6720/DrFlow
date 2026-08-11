import { expect, type Page } from "@playwright/test";

import { readE2ECredentials } from "./e2e-env";

export async function openPrescriptionWizard(page: Page): Promise<void> {
  const { patientId } = readE2ECredentials();

  await page.goto(`/pacientes/${patientId}?tab=recetas&action=nueva`);
  await expect(page.getByRole("heading", { name: "Nueva receta" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("navigation", { name: "Pasos de la receta" })).toBeVisible();
  await expect(page.getByText("1. Paciente y cobertura")).toBeVisible();
}

export async function completePrescriptionWizardStep1(page: Page): Promise<void> {
  const professional = page.getByLabel("Profesional prescriptor");
  const selected = await professional.inputValue();
  if (!selected) {
    await professional.selectOption({ index: 1 });
  }

  await page.getByLabel("Diagnóstico").fill("Control ambulatorio E2E");
  await page.getByLabel("CIE-10").fill("Z00.0");

  const insuranceNumber = readE2ECredentials().insuranceNumber;
  const affiliateField = page.getByLabel(/N° beneficio|N° afiliado/i);
  if (insuranceNumber && (await affiliateField.isVisible())) {
    await affiliateField.fill(insuranceNumber);
  }

  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("2. Medicamentos")).toBeVisible();
}

export async function completePrescriptionWizardStep2(page: Page): Promise<void> {
  await page.getByLabel("Nombre genérico *").first().fill("Paracetamol");
  await page.getByLabel("Posología *").first().fill("1 comprimido cada 8 hs si dolor");

  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("3. Revisar y emitir")).toBeVisible();
}

export async function submitPrescriptionWizard(page: Page): Promise<"draft" | "issued"> {
  const { issuePrescription } = readE2ECredentials();

  await page.getByRole("checkbox").first().check();

  if (issuePrescription) {
    await page.getByRole("checkbox").nth(1).check();
    await page.getByRole("button", { name: "Emitir receta" }).click();
    return "issued";
  }

  await page.getByRole("button", { name: "Guardar borrador" }).click();
  return "draft";
}
