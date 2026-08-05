import { describe, expect, it } from "vitest";

import { hceRowToClinicalRecord } from "@/lib/utils/hce-export-parse";
import { parseTeamsJsonlContent } from "@/lib/utils/teams-jsonl-parse";

describe("parseTeamsJsonlContent", () => {
  it("maps diagnostics, treatments and evolutions for a patient", () => {
    const jsonl = [
      JSON.stringify({
        id: "consumers/c110e15f",
        lastName: "abalo",
        firstName: "jorge guillermo",
        identification: "12459480",
      }),
      JSON.stringify({
        id: "records/971ddd21",
        type: "diagnostics",
        dx: "Infarto transmural agudo del miocardio de la pared anterior",
        cie10Code: "i-210",
        status: "chronic",
        startsAt: "2022-11-10",
        consumers: [{ id: "consumers/c110e15f", label: "abalo, jorge guillermo" }],
      }),
      JSON.stringify({
        id: "records/ed6b100e",
        type: "treatments",
        label: "Clopidogrel - NEFAZAN - 75 mg comp.x 30",
        status: "active",
        startsAt: "2022-11-10",
        consumers: [{ id: "consumers/c110e15f" }],
      }),
      JSON.stringify({
        id: "records/e5a7434d",
        type: "records",
        date: "2022-11-10",
        content: "<p>me comunico via telefonica</p>",
        consumers: [{ id: "consumers/c110e15f" }],
      }),
    ].join("\n");

    const { rows, stats } = parseTeamsJsonlContent(jsonl);
    expect(stats.consumers).toBe(1);
    expect(rows).toHaveLength(3);

    const diag = rows.find((r) => r.tipo_registro === "diagnostics");
    expect(diag?.document_number).toBe("12459480");
    const clinical = hceRowToClinicalRecord(diag!);
    expect(clinical?.marker).toBe("[IMPORT:records/971ddd21]");

    const evo = rows.find((r) => r.tipo_registro === "records");
    expect(evo?.notas).toContain("telefonica");
  });
});
