import { type Page } from "@playwright/test";

import { hasE2EAuthCredentials, readE2ECredentials } from "./e2e-env";

function readLoginCredentials(): { email: string; password: string } {
  if (hasE2EAuthCredentials()) {
    return {
      email: process.env.E2E_EMAIL!.trim(),
      password: process.env.E2E_PASSWORD!.trim(),
    };
  }
  const full = readE2ECredentials();
  return { email: full.email, password: full.password };
}

export async function loginViaUi(page: Page): Promise<void> {
  const { email, password } = readLoginCredentials();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 });
}
