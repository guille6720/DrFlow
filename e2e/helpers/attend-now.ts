import { expect, type Page } from "@playwright/test";

import { readE2ECredentials } from "./e2e-env";

export async function openConsultationFromPatient(page: Page): Promise<void> {
  const { patientId } = readE2ECredentials();

  await page.goto(`/pacientes/${patientId}?tab=resumen`);
  await expect(page.getByRole("button", { name: "Iniciar consulta" })).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole("button", { name: "Iniciar consulta" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/pacientes/${patientId}\\?tab=soap&action=nueva`),
    { timeout: 45_000 }
  );
  await expect(page.getByLabel("Motivo de consulta")).toBeVisible({ timeout: 45_000 });
}
