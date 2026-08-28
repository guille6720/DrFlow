import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { hasE2EAuthCredentials } from "./helpers/e2e-env";

type Phase6 = { patientA: string; patientB: string; docA: string; docB: string };

function loadPhase6(): Phase6 | null {
  const path = resolve(process.cwd(), "e2e/.phase6-env.local");
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const pick = (key: string) => text.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();
  const patientA = pick("E2E_PHASE6_PATIENT_A");
  const patientB = pick("E2E_PHASE6_PATIENT_B");
  if (!patientA || !patientB) return null;
  return { patientA, patientB, docA: "90060001", docB: "90060002" };
}

async function waitForPatientDoc(page: Page, doc: string, forbidden?: string) {
  await expect(page.locator("body")).toContainText(doc, { timeout: 30_000 });
  if (forbidden) {
    await expect(page.locator("body")).not.toContainText(forbidden);
  }
}

async function assertNoForbiddenFlash(page: Page, forbidden: string, ms = 800) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    const visible = await page.locator("body").getByText(forbidden, { exact: false }).isVisible().catch(() => false);
    if (visible) {
      throw new Error(`Stale cross-patient flash detected: ${forbidden}`);
    }
    await page.waitForTimeout(50);
  }
}


async function softNavMs(page: Page, href: string): Promise<number> {
  const start = Date.now();
  await page.goto(href, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  return Date.now() - start;
}

const perfResults: Record<string, number[]> = {};

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.skip(!hasE2EAuthCredentials(), "Requires E2E_EMAIL / E2E_PASSWORD in .env.local");
  test.skip(!loadPhase6(), "Requires e2e/.phase6-env.local with phase6 patients");
});

test.beforeEach(async ({ page }) => {
  await loginViaUi(page);
});

test.describe("Release gate — patient isolation", () => {
  test("no cross-patient content after soft navigation", async ({ page }) => {
    const phase6 = loadPhase6()!;

    await page.goto(`/pacientes/${phase6.patientA}?tab=soap`);
    await waitForPatientDoc(page, phase6.docA, phase6.docB);

    await page.goto(`/pacientes/${phase6.patientA}?tab=diagnosticos`);
    await waitForPatientDoc(page, phase6.docA, phase6.docB);

    await page.goto(`/pacientes/${phase6.patientA}?tab=recetas`);
    await waitForPatientDoc(page, phase6.docA, phase6.docB);

    await page.goto(`/pacientes/${phase6.patientB}?tab=soap`);
    await waitForPatientDoc(page, phase6.docB, phase6.docA);

    await page.goto(`/pacientes/${phase6.patientB}?tab=diagnosticos`);
    await waitForPatientDoc(page, phase6.docB, phase6.docA);
  });

  test("rapid A→B→A→B without stale flash", async ({ page }) => {
    const phase6 = loadPhase6()!;
    const sequence = [
      { id: phase6.patientA, doc: phase6.docA, forbidden: phase6.docB, tab: "soap" },
      { id: phase6.patientB, doc: phase6.docB, forbidden: phase6.docA, tab: "diagnosticos" },
      { id: phase6.patientA, doc: phase6.docA, forbidden: phase6.docB, tab: "recetas" },
      { id: phase6.patientB, doc: phase6.docB, forbidden: phase6.docA, tab: "ordenes" },
      { id: phase6.patientA, doc: phase6.docA, forbidden: phase6.docB, tab: "historia" },
      { id: phase6.patientB, doc: phase6.docB, forbidden: phase6.docA, tab: "gemini" },
    ] as const;

    for (const step of sequence) {
      await page.goto(`/pacientes/${step.id}?tab=${step.tab}`);
      await waitForPatientDoc(page, step.doc, step.forbidden);
      await assertNoForbiddenFlash(page, step.forbidden);
    }
  });
});

test.describe("Release gate — agenda", () => {
  test("canonical agenda views, filters, and legacy redirect", async ({ page }) => {
    await page.goto("/turnos/agenda?view=week");
    await expect(page).toHaveURL(/\/turnos\/agenda\?view=week/, { timeout: 15_000 });

    await page.getByRole("button", { name: "Día", exact: true }).click();
    await expect(page).toHaveURL(/\/turnos\/agenda(?:\?[^#]*)?$/);
    await expect(page).not.toHaveURL(/view=(week|month)/);

    await page.getByRole("button", { name: "Semana", exact: true }).click();
    await expect(page).toHaveURL(/view=week/);

    await page.getByRole("button", { name: "Mes", exact: true }).click();
    await expect(page).toHaveURL(/view=month/);

    const prevMonth = page.getByRole("button", { name: "Mes anterior" });
    if (await prevMonth.isEnabled()) await prevMonth.click();
    const nextMonth = page.getByRole("button", { name: "Mes siguiente" });
    if (await nextMonth.isEnabled()) await nextMonth.click();

    await page.getByRole("button", { name: "Semana", exact: true }).click();
    await expect(page).toHaveURL(/view=week/);
    await page.getByRole("button", { name: "Semana anterior" }).click();
    await page.getByRole("button", { name: "Semana siguiente" }).click();

    await page.getByRole("button", { name: "Día", exact: true }).click();
    await page.getByRole("button", { name: "Día anterior" }).click();
    await page.getByRole("button", { name: "Día siguiente" }).click();

    const medico = page.locator('select').filter({ has: page.locator('option', { hasText: "Todos los médicos" }) }).first();
    if (await medico.count()) {
      await medico.selectOption({ index: 1 }).catch(() => medico.selectOption({ index: 0 }));
    }

    const specialty = page.locator('select').filter({ has: page.locator('option', { hasText: "Todas las especialidades" }) }).first();
    if (await specialty.count()) {
      await specialty.selectOption({ index: 0 });
    }

    await page.goto("/agenda?view=week&doctor=test");
    await expect(page).toHaveURL(/\/turnos\/agenda\?view=week&doctor=test/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/turnos\/agenda/);
  });

  test("appointment dialog close paths", async ({ page }) => {
    await page.goto("/turnos/agenda?view=week");
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const appointment = page.locator('[class*="appointment"], [data-testid*="appointment"], button[class*="drflow"]').filter({ hasText: /E2E|Phase6|9006000/i }).first();
    const fallback = page.locator("button").filter({ hasText: /:\d{2}/ }).first();
    const slot = (await appointment.count()) > 0 ? appointment : fallback;

    if (!(await slot.count())) {
      test.skip(true, "No agenda appointments visible for dialog test");
    }

    await slot.click();
    const dialog = page.locator(".drflow-modal-panel").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole("button", { name: "Cerrar" }).first().click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    await slot.click();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    await slot.click();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.locator('button[aria-label="Cerrar"]').click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });
});

test.describe("Release gate — waiting room", () => {
  test("waiting room renders without absurd elapsed values", async ({ page }) => {
    await page.goto("/sala-espera");
    await expect(page.getByRole("heading", { name: /Sala de espera/i })).toBeVisible({ timeout: 20_000 });

    const body = page.locator("body");
    await expect(body).not.toContainText(/-\d{2}:\d{2}/);
    await expect(body).not.toContainText(/\d{3,}:\d{2}/);
    await expect(body).not.toContainText(/999:99/);

    const timers = page.locator('.font-mono.tabular-nums');
    const count = await timers.count();
    for (let i = 0; i < count; i++) {
      const text = (await timers.nth(i).innerText()).trim();
      if (!text || text.startsWith(">")) continue;
      const match = text.match(/^(\d{1,2}):(\d{2})$/);
      if (match) {
        const minutes = Number(match[1]);
        expect(minutes).toBeLessThan(12 * 60);
      }
    }
  });
});

test.describe("Release gate — performance (warm nav)", () => {
  test("measure warm internal navigations", async ({ page }) => {
    test.setTimeout(300_000);
    const phase6 = loadPhase6()!;
    const routes: Array<{ name: string; href: string }> = [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Agenda", href: "/turnos/agenda" },
      { name: "Patients", href: "/pacientes" },
      { name: "Clinical History", href: `/pacientes/${phase6.patientA}?tab=soap` },
      { name: "Consultations", href: "/consultas" },
      { name: "Waiting Room", href: "/sala-espera" },
    ];

    for (const route of routes) {
      await softNavMs(page, route.href);
      const runs: number[] = [];
      for (let i = 0; i < 3; i++) {
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        runs.push(await softNavMs(page, route.href));
      }
      perfResults[route.name] = runs;
    }

    for (const [name, runs] of Object.entries(perfResults)) {
      const sorted = [...runs].sort((a, b) => a - b);
      const median = sorted[1] ?? sorted[0] ?? 0;
      const worst = sorted[sorted.length - 1] ?? 0;
      console.log(`PERF ${name} runs=${runs.join(",")} median=${median} worst=${worst}`);
    }
  });
});
