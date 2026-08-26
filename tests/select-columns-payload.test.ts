import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_REMINDER_COLUMNS,
  MEDICAL_ORDER_LIST_COLUMNS,
  PATIENT_ADMIN_COLUMNS,
  PATIENT_DETAIL_COLUMNS,
  PRESCRIPTION_RECENT_LIST_COLUMNS,
  PUBLIC_BOOKING_LINK_COLUMNS,
} from "@/core/supabase/select-columns";

/** Approximate bytes per omitted column in PostgREST JSON responses. */
const AVG_OMITTED_COLUMN_BYTES = 48;

function columnCount(select: string): number {
  return select.split(",").map((part) => part.trim()).filter(Boolean).length;
}

describe("select-columns payload reduction", () => {
  it("patient detail selects fewer columns than a full-row wildcard", () => {
    // patients Row currently has 29 columns (incl. Phase 2 identity fields).
    const fullRowColumns = 29;
    const detailColumns = columnCount(PATIENT_DETAIL_COLUMNS);
    expect(detailColumns).toBeLessThan(fullRowColumns);
    expect(PATIENT_DETAIL_COLUMNS).toContain("cuil");
    expect(PATIENT_DETAIL_COLUMNS).toContain("document_type");
    expect((fullRowColumns - detailColumns) * AVG_OMITTED_COLUMN_BYTES).toBeGreaterThan(0);
  });

  it("admin patient panel omits clinical narrative fields", () => {
    expect(PATIENT_ADMIN_COLUMNS).not.toContain("allergies");
    expect(PATIENT_ADMIN_COLUMNS).not.toContain("medical_history");
    expect(columnCount(PATIENT_ADMIN_COLUMNS)).toBeLessThan(columnCount(PATIENT_DETAIL_COLUMNS));
  });

  it("appointment reminder select excludes end_at and cancellation metadata", () => {
    expect(APPOINTMENT_REMINDER_COLUMNS).not.toContain("end_at");
    expect(APPOINTMENT_REMINDER_COLUMNS).toContain("start_at");
  });

  it("medical order list excludes idempotency metadata", () => {
    expect(MEDICAL_ORDER_LIST_COLUMNS).not.toContain("idempotency_key");
    expect(MEDICAL_ORDER_LIST_COLUMNS).toContain("order_text");
  });

  it("public booking link select excludes timestamps", () => {
    expect(PUBLIC_BOOKING_LINK_COLUMNS).not.toContain("created_at");
  });

  it("recent prescription list avoids wildcard columns", () => {
    expect(PRESCRIPTION_RECENT_LIST_COLUMNS).not.toContain("*");
    expect(PRESCRIPTION_RECENT_LIST_COLUMNS).toContain("medications");
  });
});
