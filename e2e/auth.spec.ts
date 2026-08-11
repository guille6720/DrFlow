import { expect, test } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { hasE2EAuthCredentials } from "./helpers/e2e-env";

test.describe("Auth E2E", () => {
  test.skip(
    !hasE2EAuthCredentials(),
    "Set E2E_EMAIL and E2E_PASSWORD to run authenticated login tests."
  );

  test("login → dashboard", async ({ page }) => {
    await loginViaUi(page);

    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 45_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 45_000,
    });
  });
});
