import { describe, it, expect } from "vitest";
import { buildEhrPayloadFromHceRows } from "@/lib/utils/patient-ehr-from-hce";
import type { HceExportRow } from "@/lib/utils/hce-export-parse";

describe("buildEhrPayloadFromHceRows", () => {
  it("maps diagnostics and treatments from teams JSONL export", () => {
    const rows: HceExportRow[] = [
      {
        lineNumber: 2,
        paciente_id: "summary",
        last_name: "",
        first_name: "",
        document_number: null,
        tipo_registro: "diagnostics",
        fecha_inicio: "2022-11-10",
        fecha_fin: null,
        estado: "chronic",
        diagnostico: "Infarto transmural agudo del miocardio de la pared anterior",
        cie10: "I210",
        notas: "",
      },
      {
        lineNumber: 3,
        paciente_id: "summary",
        last_name: "",
        first_name: "",
        document_number: null,
        tipo_registro: "treatments",
        fecha_inicio: "2022-11-10",
        fecha_fin: null,
        estado: "active",
        diagnostico: "GASTEC 20mg",
        cie10: "",
        notas: "1 comp por día",
      },
    ];

    const { diagnosisRows, treatmentRows, consultations } = buildEhrPayloadFromHceRows(
      rows,
      "Dr. Test"
    );

    expect(diagnosisRows).toHaveLength(1);
    expect(diagnosisRows[0].name).toContain("Infarto transmural");
    expect(diagnosisRows[0].chronic).toBe(true);
    expect(treatmentRows).toHaveLength(1);
    expect(treatmentRows[0].product).toBe("GASTEC 20mg");
    expect(treatmentRows[0].product).not.toMatch(/Estado:/i);
    expect(consultations).toHaveLength(0);
  });
});
