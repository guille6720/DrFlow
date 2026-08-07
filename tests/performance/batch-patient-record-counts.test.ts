import { describe, expect, it } from "vitest";

import { batchPatientRecordCounts } from "@/lib/utils/batch-patient-record-counts";

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

  it("returns zero counts when RPC is unavailable (no table scan)", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "function not found" } }),
      from: () => {
        throw new Error("should not scan rows when RPC fails");
      },
    } ;

    const counts = await batchPatientRecordCounts(createSupabaseTestDouble(supabase), "clinic-1", ["p1", "p2", "p3"]);
    expect(counts.get("p1")).toBe(0);
    expect(counts.get("p2")).toBe(0);
    expect(counts.get("p3")).toBe(0);
  });
});
