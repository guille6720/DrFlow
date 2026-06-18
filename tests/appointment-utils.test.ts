import { describe, expect, it } from "vitest";
import { canStartConsultation, isOnlineBooking } from "@/lib/utils/appointment";

describe("appointment utils", () => {
  it("detects online booking by source", () => {
    expect(isOnlineBooking({ booking_source: "online", notes: null })).toBe(true);
    expect(isOnlineBooking({ booking_source: "manual", notes: null })).toBe(false);
  });

  it("detects legacy online bookings from notes", () => {
    expect(
      isOnlineBooking({ booking_source: "manual", notes: "Solicitud online" })
    ).toBe(true);
  });

  it("allows starting consultation for pending or confirmed", () => {
    expect(canStartConsultation("pending")).toBe(true);
    expect(canStartConsultation("confirmed")).toBe(true);
    expect(canStartConsultation("attended")).toBe(false);
    expect(canStartConsultation("cancelled")).toBe(false);
  });
});
