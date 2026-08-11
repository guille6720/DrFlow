import { expect, type Page } from "@playwright/test";

import { readE2ECredentials } from "./e2e-env";

export async function loginViaUi(page: Page): Promise<void> {
  const { email, password } = readE2ECredentials();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 45_000 });
}
