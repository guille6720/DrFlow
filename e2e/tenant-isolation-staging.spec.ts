import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { hasE2EAuthCredentials } from "./helpers/e2e-env";

type Phase3 = {
  patientA: string;
  sameClinicPatientB: string;
  crossClinicPatientB: string;
  docA: string;
  sameClinicDocB: string;
  crossClinicDocB: string;
};

function loadPhase3(): Phase3 | null {
  const path = resolve(process.cwd(), "e2e/.phase3-tenant-env.local");
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const pick = (key: string) => text.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();
  const patientA = pick("PHASE3_PATIENT_A");
  const crossClinicPatientB = pick("PHASE3_PATIENT_B");
  const sameClinicPatientB = pick("PHASE3_SAME_CLINIC_PATIENT_B");
  if (!patientA || !crossClinicPatientB || !sameClinicPatientB) return null;
  return {
    patientA,
    sameClinicPatientB,
    crossClinicPatientB,
    docA: pick("PHASE3_DOC_A") ?? "90060001",
    sameClinicDocB: "90060002",
    crossClinicDocB: pick("PHASE3_DOC_B") ?? "90070001",
  };
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
    const visible = await page
      .locator("body")
      .getByText(forbidden, { exact: false })
      .isVisible()
      .catch(() => false);
    if (visible) {
      throw new Error(`Stale cross-patient flash detected: ${forbidden}`);
    }
    await page.waitForTimeout(50);
  }
}

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.skip(!hasE2EAuthCredentials(), "Requires E2E_EMAIL / E2E_PASSWORD in .env.local");
  test.skip(!loadPhase3(), "Requires e2e/.phase3-tenant-env.local");
});

test.beforeEach(async ({ page }) => {
  await loginViaUi(page);
});

test.describe("Phase 3 — same-clinic rapid patient switching", () => {
  test("Patient A → SOAP → diagnoses → prescriptions → Patient B → tabs → Patient A", async ({
    page,
  }) => {
    const p3 = loadPhase3()!;

    await page.goto(`/pacientes/${p3.patientA}?tab=soap`);
    await waitForPatientDoc(page, p3.docA, p3.sameClinicDocB);

    await page.goto(`/pacientes/${p3.patientA}?tab=diagnosticos`);
    await waitForPatientDoc(page, p3.docA, p3.sameClinicDocB);

    await page.goto(`/pacientes/${p3.patientA}?tab=recetas`);
    await waitForPatientDoc(page, p3.docA, p3.sameClinicDocB);

    await page.goto(`/pacientes/${p3.sameClinicPatientB}?tab=soap`);
    await waitForPatientDoc(page, p3.sameClinicDocB, p3.docA);

    await page.goto(`/pacientes/${p3.sameClinicPatientB}?tab=diagnosticos`);
    await waitForPatientDoc(page, p3.sameClinicDocB, p3.docA);

    await page.goto(`/pacientes/${p3.patientA}?tab=historia`);
    await waitForPatientDoc(page, p3.docA, p3.sameClinicDocB);
  });

  test("rapid A→B→A→B without stale flash", async ({ page }) => {
    const p3 = loadPhase3()!;
    const sequence = [
      { id: p3.patientA, doc: p3.docA, forbidden: p3.sameClinicDocB, tab: "soap" },
      { id: p3.sameClinicPatientB, doc: p3.sameClinicDocB, forbidden: p3.docA, tab: "diagnosticos" },
      { id: p3.patientA, doc: p3.docA, forbidden: p3.sameClinicDocB, tab: "recetas" },
      { id: p3.sameClinicPatientB, doc: p3.sameClinicDocB, forbidden: p3.docA, tab: "ordenes" },
      { id: p3.patientA, doc: p3.docA, forbidden: p3.sameClinicDocB, tab: "historia" },
      { id: p3.sameClinicPatientB, doc: p3.sameClinicDocB, forbidden: p3.docA, tab: "gemini" },
    ] as const;

    for (const step of sequence) {
      await page.goto(`/pacientes/${step.id}?tab=${step.tab}`);
      await waitForPatientDoc(page, step.doc, step.forbidden);
      await assertNoForbiddenFlash(page, step.forbidden);
    }
  });
});

test.describe("Phase 3 — cross-clinic URL access (User A)", () => {
  test("User A opening Clinic B patient URL must not show Clinic B PHI", async ({ page }) => {
    const p3 = loadPhase3()!;

    await page.goto(`/pacientes/${p3.crossClinicPatientB}?tab=soap`);
    await expect(page.locator("body")).not.toContainText(p3.crossClinicDocB, { timeout: 15_000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/E2EPhase3\s+TenantB/);
  });
});
