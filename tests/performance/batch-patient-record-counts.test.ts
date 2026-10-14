import { describe, expect, it } from "vitest";

import {
  batchPatientConsultationCounts,
  batchPatientConsultationCountsDetailed,
  batchPatientRecordCounts,
} from "@/lib/utils/batch-patient-record-counts";

import { createSupabaseTestDouble } from "../helpers/mock-supabase-client";

describe("batchPatientRecordCounts", () => {
  it("returns empty map for no patient ids", async () => {
    const supabase = {
      rpc: async () => ({ data: [], error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({ data: [] }),
          }),
        }),
      }),
    } ;

    const counts = await batchPatientRecordCounts(createSupabaseTestDouble(supabase), "clinic-1", []);
    expect(counts.size).toBe(0);
  });

  it("uses RPC aggregation when available", async () => {
    const supabase = {
      rpc: async () => ({
        data: [
          { patient_id: "p1", count: 3 },
          { patient_id: "p2", count: 1 },
        ],
        error: null,
      }),
      from: () => {
        throw new Error("should not scan rows when RPC succeeds");
      },
    } ;

    const counts = await batchPatientRecordCounts(createSupabaseTestDouble(supabase), "clinic-1", ["p1", "p2", "p3"]);
    expect(counts.get("p1")).toBe(3);
    expect(counts.get("p2")).toBe(1);
    expect(counts.get("p3")).toBe(0);
  });

  it("parses JSONB RPC payload returned as JSON string", async () => {
    const supabase = {
      rpc: async () => ({
        data: JSON.stringify([
          { patient_id: "p1", count: 4 },
          { patient_id: "p2", count: 2 },
        ]),
        error: null,
      }),
      from: () => {
        throw new Error("should not scan rows when RPC succeeds");
      },
    };

    const counts = await batchPatientRecordCounts(createSupabaseTestDouble(supabase), "clinic-1", [
      "p1",
      "p2",
    ]);
    expect(counts.get("p1")).toBe(4);
    expect(counts.get("p2")).toBe(2);
  });

  it("falls back to row scan when RPC is unavailable", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "function not found" } }),
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: [
                { patient_id: "p1" },
                { patient_id: "p1" },
                { patient_id: "p2" },
              ],
            }),
          }),
        }),
      }),
    };

    const counts = await batchPatientRecordCounts(createSupabaseTestDouble(supabase), "clinic-1", ["p1", "p2", "p3"]);
    expect(counts.get("p1")).toBe(2);
    expect(counts.get("p2")).toBe(1);
    expect(counts.get("p3")).toBe(0);
  });
});

describe("batchPatientConsultationCounts", () => {
  it("uses fast RPC path for list badges (no clinical_records scan)", async () => {
    const supabase = {
      rpc: async () => ({
        data: [
          { patient_id: "p1", count: 3 },
          { patient_id: "p2", count: 1 },
        ],
        error: null,
      }),
      from: () => {
        throw new Error("list counts must not scan clinical_records when RPC works");
      },
    };

    const counts = await batchPatientConsultationCounts(createSupabaseTestDouble(supabase), "clinic-1", [
      "p1",
      "p2",
      "p3",
    ]);

    expect(counts.get("p1")).toBe(3);
    expect(counts.get("p2")).toBe(1);
    expect(counts.get("p3")).toBe(0);
  });
});

describe("batchPatientConsultationCountsDetailed", () => {
  function mockClinicalRecordsFrom(tableHandlers: Record<string, unknown>) {
    return (table: string) => {
      const handler = tableHandlers[table];
      if (!handler) throw new Error(`unexpected table ${table}`);
      return handler;
    };
  }

  type RecordRow = Record<string, unknown> & { lifecycle_status?: string };

  /** Mimics PostgREST: `.eq("lifecycle_status", v)` filters rows; `lifecycleError` simulates a pre-131 schema. */
  function clinicalRecordsTable(
    rows: RecordRow[],
    options: { lifecycleError?: string; filters?: Array<[string, unknown]> } = {}
  ) {
    const finalOrder = (filtered: RecordRow[]) => ({
      order: async () => ({ data: filtered.map(({ lifecycle_status: _ls, ...rest }) => rest), error: null }),
    });
    return {
      select: () => ({
        eq: () => ({
          in: () => ({
            ...finalOrder(rows),
            eq: (column: string, value: unknown) => {
              options.filters?.push([column, value]);
              if (column === "lifecycle_status" && options.lifecycleError) {
                return { order: async () => ({ data: null, error: { message: options.lifecycleError } }) };
              }
              return finalOrder(rows.filter((row) => (row.lifecycle_status ?? "active") === value));
            },
          }),
        }),
      }),
    };
  }

  const noHceAttachments = {
    select: () => ({
      eq: () => ({
        eq: () => ({
          in: async () => ({ data: [] }),
        }),
      }),
    }),
  };

  function evolutionRow(id: string, createdAt: string, extra: Partial<RecordRow> = {}): RecordRow {
    return {
      patient_id: "p1",
      id,
      created_at: createdAt,
      chief_complaint: "Control",
      diagnosis: "HTA",
      evolution: `Evolución ${id} con texto clínico suficiente para el sidebar.`,
      indications: "",
      ...extra,
    };
  }

  it("uses HCE sidebar counts when clinical_records are empty", async () => {
    const csv = [
      "paciente_id,last_name,first_name,document_number,tipo_registro,fecha_inicio,fecha_fin,estado,diagnostico,cie10,notas",
      'summary,Amaya,Rosa,123,records,2023-03-14,,,Control,,"Evolución importada desde HCE con texto clínico."',
      'summary,Amaya,Rosa,123,records,2021-12-02,,,Control,,"Segunda evolución importada."',
    ].join("\n");

    const supabase = {
      from: mockClinicalRecordsFrom({
        clinical_records: clinicalRecordsTable([]),
        patient_attachments: {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => ({
                  data: [{ patient_id: "p1", file_path: "clinic/p1/hce-export-resumen.csv" }],
                }),
              }),
            }),
          }),
        },
      }),
      storage: {
        from: () => ({
          download: async () => ({
            data: {
              text: async () => csv,
            },
            error: null,
          }),
        }),
      },
    };

    const counts = await batchPatientConsultationCountsDetailed(
      createSupabaseTestDouble(supabase),
      "clinic-1",
      ["p1"]
    );

    expect(counts.get("p1")).toBe(2);
  });

  it("counts each evolution on the same calendar day separately", async () => {
    const supabase = {
      from: mockClinicalRecordsFrom({
        clinical_records: clinicalRecordsTable([
          evolutionRow("r1", "2023-03-14T10:00:00.000Z"),
          evolutionRow("r2", "2023-03-14T18:00:00.000Z"),
        ]),
        patient_attachments: noHceAttachments,
      }),
      rpc: async () => ({
        data: [{ patient_id: "p1", count: 2 }],
        error: null,
      }),
    };

    const consultationCounts = await batchPatientConsultationCountsDetailed(
      createSupabaseTestDouble(supabase),
      "clinic-1",
      ["p1"]
    );
    const recordCounts = await batchPatientRecordCounts(createSupabaseTestDouble(supabase), "clinic-1", [
      "p1",
    ]);

    expect(consultationCounts.get("p1")).toBe(2);
    expect(recordCounts.get("p1")).toBe(2);
  });

  it("excludes archived, superseded and corrected records", async () => {
    const filters: Array<[string, unknown]> = [];
    const supabase = {
      from: mockClinicalRecordsFrom({
        clinical_records: clinicalRecordsTable(
          [
            evolutionRow("r1", "2023-03-14T10:00:00.000Z", { lifecycle_status: "active" }),
            evolutionRow("r2", "2023-03-14T11:00:00.000Z", { lifecycle_status: "archived" }),
            evolutionRow("r3", "2023-03-15T10:00:00.000Z", { lifecycle_status: "superseded" }),
            evolutionRow("r4", "2023-03-16T10:00:00.000Z", { lifecycle_status: "corrected" }),
            evolutionRow("r5", "2023-03-17T10:00:00.000Z", { lifecycle_status: "active" }),
          ],
          { filters }
        ),
        patient_attachments: noHceAttachments,
      }),
    };

    const counts = await batchPatientConsultationCountsDetailed(
      createSupabaseTestDouble(supabase),
      "clinic-1",
      ["p1"]
    );

    expect(filters).toContainEqual(["lifecycle_status", "active"]);
    expect(counts.get("p1")).toBe(2);
  });

  it("falls back to unfiltered records when lifecycle_status is missing (pre-131 schema)", async () => {
    const supabase = {
      from: mockClinicalRecordsFrom({
        clinical_records: clinicalRecordsTable(
          [
            evolutionRow("r1", "2023-03-14T10:00:00.000Z"),
            evolutionRow("r2", "2023-03-15T10:00:00.000Z"),
          ],
          { lifecycleError: "column clinical_records.lifecycle_status does not exist" }
        ),
        patient_attachments: noHceAttachments,
      }),
    };

    const counts = await batchPatientConsultationCountsDetailed(
      createSupabaseTestDouble(supabase),
      "clinic-1",
      ["p1"]
    );

    expect(counts.get("p1")).toBe(2);
  });

  it("counts consultations from clinical_records without HCE attachment", async () => {
    const supabase = {
      from: mockClinicalRecordsFrom({
        clinical_records: clinicalRecordsTable([
          evolutionRow("r1", "2023-03-14T10:00:00.000Z"),
          evolutionRow("r2", "2021-12-02T10:00:00.000Z"),
        ]),
        patient_attachments: noHceAttachments,
      }),
    };

    const counts = await batchPatientConsultationCountsDetailed(
      createSupabaseTestDouble(supabase),
      "clinic-1",
      ["p1"]
    );

    expect(counts.get("p1")).toBe(2);
  });
});
