import { describe, it, expect } from "vitest";
import { formatCurrency } from "@/lib/services/payments";
import { buildAppointmentReminderMessage } from "@/lib/services/reminders";

describe("Mock services", () => {
  it("formats currency in ARS", () => {
    const formatted = formatCurrency(15000);
    expect(formatted).toContain("15");
  });

  it("builds reminder message with patient name", () => {
    const msg = buildAppointmentReminderMessage("María González", "15/06/2026", "Dr. Pérez");
    expect(msg).toContain("María González");
    expect(msg).toContain("Dr. Pérez");
  });
});
