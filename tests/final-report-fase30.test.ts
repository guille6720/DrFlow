/**
 * Phase 30 — Final report structure & honesty tests.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  evaluateFinalReportPosture,
  FINAL_REPORT_MONETIZATION_ANSWER,
  FINAL_REPORT_PATH,
  FINAL_REPORT_REQUIRED_SECTIONS,
  FINAL_REPORT_STOP_LINE,
  FINAL_REPORT_VERDICT,
} from "@/core/compliance/final-report-argentina";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("final-report-argentina", () => {
  it("posture is apto con pendientes and YES WITH CONDITIONS; no prod deploy", () => {
    const posture = evaluateFinalReportPosture();
    expect(posture.verdict).toBe(FINAL_REPORT_VERDICT);
    expect(posture.monetizationAnswer).toBe(FINAL_REPORT_MONETIZATION_ANSWER);
    expect(posture.productionDeployed).toBe(false);
    expect(posture.awaitingOwnerAuthorization).toBe(true);
  });

  it("INFORME FINAL has all required sections and stop line", () => {
    const doc = read(FINAL_REPORT_PATH);
    expect(doc).toContain("# INFORME FINAL — DRFLOW ARGENTINA");
    expect(doc).toContain("🟡 APTO CON PENDIENTES");
    expect(doc).toContain("YES WITH CONDITIONS");
    expect(doc).toMatch(/NO puede afirmar emisión legal|NO puede afirmar/i);
    expect(doc).toContain(FINAL_REPORT_STOP_LINE);
    for (const section of FINAL_REPORT_REQUIRED_SECTIONS) {
      expect(doc).toContain(section);
    }
    expect(doc.trimEnd().endsWith(FINAL_REPORT_STOP_LINE)).toBe(true);
  });
});
