import { describe, expect, it, vi } from "vitest";

import { PATIENT_LIST_ID_IN_LIMIT } from "@/core/supabase/pagination";

import { capUniquePatientIds, findPatientIdsByPathologySearch } from "@/features/pacientes/utils/patient-search";

describe("findPatientIdsByPathologySearch", () => {
  it("uses RPC for single round trip when available", async () => {
    const rpc = vi.fn(async () => ({
      data: ["p1", "p2"],
      error: null,
    }));
    const from = vi.fn(() => {
      throw new Error("should not query per token when RPC succeeds");
    });

    const result = await findPatientIdsByPathologySearch(
      { from, rpc } as never,
      "clinic-1",
      "hipertension diabetes"
    );

    expect(result.patientIds).toEqual(["p1", "p2"]);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("search_patient_ids_by_pathology", {
      p_clinic_id: "clinic-1",
      p_query: "hipertension diabetes",
    });
  });

  it("falls back to per-token queries when RPC is unavailable", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "function not found" },
    }));

    let call = 0;
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          or: () => ({
            limit: async () => {
              call += 1;
              if (call === 1) {
                return { data: [{ patient_id: "p1" }, { patient_id: "p2" }], error: null };
              }
              return { data: [{ patient_id: "p1" }], error: null };
            },
          }),
        }),
      }),
    }));

    const result = await findPatientIdsByPathologySearch(
      { from, rpc } as never,
      "clinic-1",
      "hta control"
    );

    expect(result.patientIds).toEqual(["p1"]);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("caps and dedupes RPC patient ids before list .in() filters", async () => {
    const ids = Array.from({ length: PATIENT_LIST_ID_IN_LIMIT + 80 }, (_, i) => `p${i}`);
    ids.push("p0", "p1");
    const rpc = vi.fn(async () => ({ data: ids, error: null }));

    const result = await findPatientIdsByPathologySearch(
      { from: vi.fn(), rpc } as never,
      "clinic-1",
      "hta"
    );

    expect(result.patientIds).toHaveLength(PATIENT_LIST_ID_IN_LIMIT);
    expect(new Set(result.patientIds).size).toBe(PATIENT_LIST_ID_IN_LIMIT);
  });
});

describe("capUniquePatientIds", () => {
  it("drops duplicates and respects the cap", () => {
    expect(capUniquePatientIds(["a", "a", "b", "c"], 2)).toEqual(["a", "b"]);
  });
});
