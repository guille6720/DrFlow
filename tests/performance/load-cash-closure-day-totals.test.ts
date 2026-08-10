import { describe, expect, it } from "vitest";

import { loadCashClosureDayTotals } from "@/features/caja/server/load-cash-closure-day-totals";

import { createSupabaseTestDouble } from "../helpers/mock-supabase-client";

describe("loadCashClosureDayTotals", () => {
  it("uses closure RPC when available", async () => {
    const supabase = {
      rpc: async (fn: string) => {
        expect(fn).toBe("summarize_collected_cash_charges_for_closure");
        return {
          data: {
            general: 1000,
            particular: 400,
            copago: 0,
            coseguro: 0,
            art: 0,
            obra_social: 600,
            cash: 800,
            debit: 200,
            credit: 0,
            transfer: 0,
            mercadopago: 0,
            qr: 0,
            account: 0,
            patient_count: 5,
            consultation_count: 7,
          },
          error: null,
        };
      },
      from: () => {
        throw new Error("should not scan rows when RPC succeeds");
      },
    };

    const result = await loadCashClosureDayTotals(
      createSupabaseTestDouble(supabase),
      "clinic-1",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T23:59:59.999Z"
    );

    expect(result.totals.general).toBe(1000);
    expect(result.totals.obra_social).toBe(600);
    expect(result.patientCount).toBe(5);
    expect(result.consultationCount).toBe(7);
  });

  it("falls back to row scan when RPC is missing", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "function not found" } }),
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                lte: async () => ({
                  data: [
                    {
                      amount: 100,
                      payment_method: "cash",
                      attention_type: "particular",
                      charge_kind: "consulta_particular",
                      patient_id: "p1",
                    },
                    {
                      amount: 50,
                      payment_method: "debit",
                      attention_type: "obra_social",
                      charge_kind: "copago_autorizado",
                      patient_id: "p2",
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await loadCashClosureDayTotals(
      createSupabaseTestDouble(supabase),
      "clinic-1",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T23:59:59.999Z"
    );

    expect(result.totals.general).toBe(150);
    expect(result.totals.particular).toBe(100);
    expect(result.patientCount).toBe(2);
    expect(result.consultationCount).toBe(2);
  });
});
