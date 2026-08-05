import { describe, expect, it } from "vitest";

import { batchPatientRecordCounts } from "@/lib/utils/batch-patient-record-counts";

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
    } as never;

    const counts = await batchPatientRecordCounts(supabase, "clinic-1", []);
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
    } as never;

    const counts = await batchPatientRecordCounts(supabase, "clinic-1", ["p1", "p2", "p3"]);
    expect(counts.get("p1")).toBe(3);
    expect(counts.get("p2")).toBe(1);
    expect(counts.get("p3")).toBe(0);
  });

  it("falls back to row scan when RPC is unavailable", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "function not found" } }),
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: [{ patient_id: "p1" }, { patient_id: "p1" }, { patient_id: "p2" }],
            }),
          }),
        }),
      }),
    } as never;

    const counts = await batchPatientRecordCounts(supabase, "clinic-1", ["p1", "p2", "p3"]);
    expect(counts.get("p1")).toBe(2);
    expect(counts.get("p2")).toBe(1);
    expect(counts.get("p3")).toBe(0);
  });
});
