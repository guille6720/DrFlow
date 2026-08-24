/**
 * Phase 24 — AAIP checklist separation & honesty tests.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  AAIP_DATABASE_REGISTRATION_FLAG,
  AAIP_EXTERNAL_TASKS,
  AAIP_TECHNICAL_TASKS,
  evaluateAaipChecklistPosture,
  getAaipDatabaseRegistrationTask,
} from "@/core/compliance/aaip-checklist";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("aaip-checklist policy module", () => {
  it("separates technical and external tasks", () => {
    expect(AAIP_TECHNICAL_TASKS.length).toBeGreaterThanOrEqual(10);
    expect(AAIP_EXTERNAL_TASKS.length).toBeGreaterThanOrEqual(5);
    expect(AAIP_EXTERNAL_TASKS.every((t) => t.claimedCompletedInSoftware === false)).toBe(true);
  });

  it("flags database registration as external — not solvable in code", () => {
    const task = getAaipDatabaseRegistrationTask();
    expect(task.flag).toBe(AAIP_DATABASE_REGISTRATION_FLAG);
    expect(AAIP_DATABASE_REGISTRATION_FLAG).toContain("NO SE RESUELVE CON CÓDIGO");
    expect(task.claimedCompletedInSoftware).toBe(false);
  });

  it("evaluateAaipChecklistPosture never claims registration or Ley 25.326 compliance", () => {
    const posture = evaluateAaipChecklistPosture();
    expect(posture.databaseRegistrationSolvableInCode).toBe(false);
    expect(posture.claimsAaipRegistrationOccurred).toBe(false);
    expect(posture.certifiesLey25326Compliance).toBe(false);
    expect(posture.databaseRegistrationFlag).toBe(AAIP_DATABASE_REGISTRATION_FLAG);
  });
});

describe("AAIP-CHECKLIST.md (static)", () => {
  it("has Technical tasks and External administrative/legal tasks sections", () => {
    const doc = read("docs/compliance/AAIP-CHECKLIST.md");
    expect(doc).toContain("## Technical tasks");
    expect(doc).toContain("## External administrative/legal tasks");
    expect(doc).toContain(AAIP_DATABASE_REGISTRATION_FLAG);
    expect(doc).toMatch(/no afirma que el registro AAIP haya ocurrido/i);
    expect(doc).not.toMatch(/registro AAIP (completado|realizado|inscripto|inscrito)/i);
    expect(doc).not.toMatch(/certifica(mos)? cumplimiento (de )?(la )?Ley 25\.326/i);
  });

  it("lists technical evidence without claiming external registration done", () => {
    const doc = read("docs/compliance/AAIP-CHECKLIST.md");
    expect(doc).toContain("sanitizeClinicalAIInput");
    expect(doc).toContain("subprocessors.ts");
    expect(doc).toContain("GESTIÓN EXTERNA");
  });
});
