import { test } from "@playwright/test";

import { openConsultationFromPatient } from "./helpers/attend-now";
import { loginViaUi } from "./helpers/auth";
import { hasE2ECredentials } from "./helpers/e2e-env";

test.describe("Attend now E2E", () => {
  test.skip(
    !hasE2ECredentials(),
    "Set E2E_EMAIL, E2E_PASSWORD, and E2E_PATIENT_ID to run attend-now tests."
  );

  test.beforeEach(async ({ page }) => {
    await loginViaUi(page);
  });

  test("login → patient workspace → iniciar consulta", async ({ page }) => {
    await openConsultationFromPatient(page);
  });
});
