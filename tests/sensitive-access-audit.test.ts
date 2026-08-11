import { describe, expect, it } from "vitest";

import {
  buildSensitiveAccessDedupeKey,
  SENSITIVE_ACCESS_DEDUPE_MINUTES,
  sensitiveAccessWhat,
  shouldLogWorkspaceSensitiveAccess,
} from "@/core/security/sensitive-access-audit";

import type { WorkspaceFetchPlan } from "@/features/pacientes/server/patient-workspace-fetch-plan";

describe("sensitive-access-audit", () => {
  it("uses a 15-minute dedupe window constant", () => {
    expect(SENSITIVE_ACCESS_DEDUPE_MINUTES).toBe(15);
  });

  it("buildSensitiveAccessDedupeKey includes kind, patient, tab and entity", () => {
    expect(
      buildSensitiveAccessDedupeKey({
        kind: "patient_workspace",
        patientId: "p-1",
        tab: "soap",
      })
    ).toBe("patient_workspace:p-1:soap");

    expect(
      buildSensitiveAccessDedupeKey({
        kind: "clinical_record_detail",
        patientId: "p-1",
        entityId: "cr-9",
      })
    ).toBe("clinical_record_detail:p-1:cr-9");
  });

  it("shouldLogWorkspaceSensitiveAccess skips audit and admin tabs", () => {
    const empty: WorkspaceFetchPlan = {
      clinicalRecords: false,
      attachments: false,
      prescriptions: false,
      orders: false,
      appointments: false,
      hceSummary: false,
      templates: false,
    };

    expect(shouldLogWorkspaceSensitiveAccess("auditoria", empty)).toBe(false);
    expect(shouldLogWorkspaceSensitiveAccess("docs_admin", empty)).toBe(false);
    expect(shouldLogWorkspaceSensitiveAccess("soap", { ...empty, clinicalRecords: true })).toBe(
      true
    );
  });

  it("sensitiveAccessWhat describes access context", () => {
    expect(
      sensitiveAccessWhat({
        clinicId: "c",
        patientId: "p",
        kind: "patient_workspace",
        tab: "recetas",
      })
    ).toBe("Consulta — datos clínicos del paciente (recetas)");

    expect(
      sensitiveAccessWhat({
        clinicId: "c",
        patientId: "p",
        kind: "clinical_record_detail",
      })
    ).toBe("Consulta — historia clínica");

    expect(
      sensitiveAccessWhat({
        clinicId: "c",
        patientId: "p",
        kind: "patient_admin_documents",
      })
    ).toBe("Consulta — documentos administrativos del paciente");
  });
});
