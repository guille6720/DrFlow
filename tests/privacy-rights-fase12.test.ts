import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  canFulfillPrivacyRequest,
  evaluatePrivacyDeletionOrBlockingRequest,
  evaluatePrivacyRightsPosture,
  PRIVACY_DELETION_RETENTION_WARNING,
  PRIVACY_REQUEST_TYPES,
  requiresRetentionWarning,
} from "@/core/compliance/privacy-rights";

const ROOT = process.cwd();

describe("privacy-rights policy module", () => {
  it("covers ARCO-style request types", () => {
    expect(PRIVACY_REQUEST_TYPES).toContain("access");
    expect(PRIVACY_REQUEST_TYPES).toContain("correction");
    expect(PRIVACY_REQUEST_TYPES).toContain("export");
    expect(PRIVACY_REQUEST_TYPES).toContain("deletion");
    expect(PRIVACY_REQUEST_TYPES).toContain("blocking");
  });

  it("never allows automated clinical hard-delete", () => {
    const evaluation = evaluatePrivacyDeletionOrBlockingRequest("deletion");
    expect(evaluation.allowsAutomatedClinicalHardDelete).toBe(false);
    expect(evaluation.requiresRetentionAcknowledgment).toBe(true);
    expect(evaluation.warnings.length).toBeGreaterThan(0);
    expect(PRIVACY_DELETION_RETENTION_WARNING).toMatch(/NO autoriza borrar/i);
  });

  it("requires retention ack to fulfill deletion/blocking", () => {
    expect(requiresRetentionWarning("deletion")).toBe(true);
    expect(requiresRetentionWarning("access")).toBe(false);
    expect(
      canFulfillPrivacyRequest({
        type: "deletion",
        status: "fulfilled",
        retentionWarningAcknowledged: false,
      }).ok
    ).toBe(false);
    expect(
      canFulfillPrivacyRequest({
        type: "deletion",
        status: "fulfilled",
        retentionWarningAcknowledged: true,
      }).ok
    ).toBe(true);
  });

  it("evaluatePrivacyRightsPosture reports workflow without auto hard-delete", () => {
    const posture = evaluatePrivacyRightsPosture();
    expect(posture.workflowEnabled).toBe(true);
    expect(posture.automatedClinicalHardDelete).toBe(false);
  });
});

describe("135_privacy_rights_requests migration", () => {
  const sql = readFileSync(
    resolve(ROOT, "supabase/migrations/135_privacy_rights_requests.sql"),
    "utf8"
  );

  it("creates privacy_rights_requests with ARCO types", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS privacy_rights_requests/);
    expect(sql).toMatch(/'access'/);
    expect(sql).toMatch(/'correction'/);
    expect(sql).toMatch(/'export'/);
    expect(sql).toMatch(/'deletion'/);
    expect(sql).toMatch(/'blocking'/);
  });

  it("blocks fulfill deletion/blocking without retention ack", () => {
    expect(sql).toMatch(/enforce_privacy_deletion_retention_ack/);
    expect(sql).toMatch(/PRIVACY_RETENTION_ACK_REQUIRED/);
    expect(sql).toMatch(/retention_warning_acknowledged/);
  });

  it("enables RLS without DELETE policy", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/privacy_rights_requests_select/);
    expect(sql).toMatch(/privacy_rights_requests_insert/);
    expect(sql).toMatch(/privacy_rights_requests_update/);
    expect(sql).not.toMatch(/privacy_rights_requests_delete/);
  });
});

describe("Phase 12 app wiring", () => {
  it("compliance panel mounts privacy rights section", () => {
    const src = readFileSync(
      resolve(ROOT, "src/features/configuracion/components/configuracion/compliance-legal-panel.tsx"),
      "utf8"
    );
    expect(src).toContain("PrivacyRightsRequestsSection");
    expect(src).toContain("PrivacyRightsPanel");
  });

  it("privacy actions gate retention on fulfill", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/actions/privacy-rights.ts"), "utf8");
    expect(src).toContain("canFulfillPrivacyRequest");
    expect(src).toContain("createPrivacyRightsRequest");
    expect(src).toContain("updatePrivacyRightsRequest");
  });
});
