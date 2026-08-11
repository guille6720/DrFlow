import { expect, test } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { hasE2ECredentials } from "./helpers/e2e-env";
import {
  completePrescriptionWizardStep1,
  completePrescriptionWizardStep2,
  openPrescriptionWizard,
  submitPrescriptionWizard,
} from "./helpers/prescription-wizard";

test.describe("Prescription wizard E2E", () => {
  test.skip(
    !hasE2ECredentials(),
    "Set E2E_EMAIL, E2E_PASSWORD, and E2E_PATIENT_ID to run authenticated Rx tests."
  );

  test.beforeEach(async ({ page }) => {
    await loginViaUi(page);
  });

  test("login → patient workspace → wizard → save draft", async ({ page }) => {
    await openPrescriptionWizard(page);
    await completePrescriptionWizardStep1(page);
    await completePrescriptionWizardStep2(page);

    const outcome = await submitPrescriptionWizard(page);
    expect(outcome).toBe(process.env.E2E_ISSUE_RX === "1" ? "issued" : "draft");

    await expect(page.getByRole("heading", { name: "Nueva receta" })).toBeHidden({
      timeout: 45_000,
    });

    const statusLabel = outcome === "issued" ? /Emitida|Dispensada/i : /Borrador/i;
    await expect(page.getByText(statusLabel).first()).toBeVisible({ timeout: 45_000 });
  });
});
