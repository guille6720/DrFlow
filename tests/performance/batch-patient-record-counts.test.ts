import { describe, expect, it } from "vitest";

import {
  batchPatientConsultationCounts,
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
  function mockClinicalRecordsFrom(tableHandlers: Record<string, unknown>) {
    return (table: string) => {
      const handler = tableHandlers[table];
      if (!handler) throw new Error(`unexpected table ${table}`);
      return handler;
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
        clinical_records: {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: async () => ({ data: [] }),
              }),
            }),
          }),
        },
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

    const counts = await batchPatientConsultationCounts(createSupabaseTestDouble(supabase), "clinic-1", [
      "p1",
    ]);

    expect(counts.get("p1")).toBe(2);
  });

  it("dedupes multiple records on the same calendar day", async () => {
    const supabase = {
      from: mockClinicalRecordsFrom({
        clinical_records: {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: async () => ({
                  data: [
                    {
                      patient_id: "p1",
                      id: "r1",
                      created_at: "2023-03-14T10:00:00.000Z",
                      chief_complaint: "Control",
                      diagnosis: "HTA",
                      evolution: "Primera evolución del día con texto clínico suficiente.",
                      indications: "",
                      professionals: null,
                    },
                    {
                      patient_id: "p1",
                      id: "r2",
                      created_at: "2023-03-14T18:00:00.000Z",
                      chief_complaint: "Control",
                      diagnosis: "HTA",
                      evolution: "Segunda evolución del mismo día con texto clínico.",
                      indications: "",
                      professionals: null,
                    },
                  ],
                }),
              }),
            }),
          }),
        },
        patient_attachments: {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => ({ data: [] }),
              }),
            }),
          }),
        },
      }),
      rpc: async () => ({
        data: [{ patient_id: "p1", count: 2 }],
        error: null,
      }),
    };

    const consultationCounts = await batchPatientConsultationCounts(
      createSupabaseTestDouble(supabase),
      "clinic-1",
      ["p1"]
    );
    const recordCounts = await batchPatientRecordCounts(createSupabaseTestDouble(supabase), "clinic-1", [
      "p1",
    ]);

    expect(consultationCounts.get("p1")).toBe(1);
    expect(recordCounts.get("p1")).toBe(2);
  });

  it("counts consultations from clinical_records without HCE attachment", async () => {
    const supabase = {
      from: mockClinicalRecordsFrom({
        clinical_records: {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: async () => ({
                  data: [
                    {
                      patient_id: "p1",
                      id: "r1",
                      created_at: "2023-03-14T10:00:00.000Z",
                      chief_complaint: "Control",
                      diagnosis: "HTA",
                      evolution: "Evolución clínica con texto suficiente para el sidebar.",
                      indications: "",
                      professionals: { profiles: { full_name: "Dr. López" } },
                    },
                    {
                      patient_id: "p1",
                      id: "r2",
                      created_at: "2021-12-02T10:00:00.000Z",
                      chief_complaint: "Control",
                      diagnosis: "HTA",
                      evolution: "Segunda evolución con texto clínico suficiente.",
                      indications: "",
                      professionals: { profiles: { full_name: "Dr. López" } },
                    },
                  ],
                }),
              }),
            }),
          }),
        },
        patient_attachments: {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => ({ data: [] }),
              }),
            }),
          }),
        },
      }),
    };

    const counts = await batchPatientConsultationCounts(createSupabaseTestDouble(supabase), "clinic-1", [
      "p1",
    ]);

    expect(counts.get("p1")).toBe(2);
  });
});
