import { describe, it, expect } from "vitest";
import {
  buildMigrationHealthReport,
  hasConsumerImportRef,
  isPlaceholderImportDni,
} from "@/lib/utils/migration-health";
import { HCE_SUMMARY_ATTACHMENT_NAME } from "@/features/pacientes/utils/patient-ehr-from-hce";

describe("migration-health", () => {
  it("detects placeholder DNI and consumer ref", () => {
    expect(isPlaceholderImportDni("90123456")).toBe(true);
    expect(isPlaceholderImportDni("12459480")).toBe(false);
    expect(hasConsumerImportRef("ID importación: consumers/abc")).toBe(true);
  });

  it("flags pending PDF when HCE exists without evolution", () => {
    const report = buildMigrationHealthReport({
      patients: [
        {
          id: "p1",
          first_name: "Jorge",
          last_name: "Abalo",
          document_number: "12459480",
          notes: "ID importación: consumers/x",
        },
      ],
      attachments: [
        {
          patient_id: "p1",
          file_name: HCE_SUMMARY_ATTACHMENT_NAME,
          file_type: "text/csv",
          category: "historia_clinica",
        },
      ],
      records: [
        {
          patient_id: "p1",
          chief_complaint: "[HCE:consumers/x:treatments:2022-11-10:3] Tratamiento importado",
          evolution: "",
        },
      ],
    });

    expect(report.pendingPdfTotal).toBe(1);
    expect(report.steps[0].status).toBe("done");
    expect(report.steps[1].status).toBe("done");
  });
});
