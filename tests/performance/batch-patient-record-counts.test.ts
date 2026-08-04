import { describe, expect, it } from "vitest";
import { batchPatientRecordCounts } from "@/lib/utils/batch-patient-record-counts";

describe("batchPatientRecordCounts", () => {
  it("returns empty map for no patient ids", async () => {
    const supabase = {
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

  it("aggregates counts in memory from one query", async () => {
    const supabase = {
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
