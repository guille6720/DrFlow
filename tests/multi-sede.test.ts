import { describe, expect, it } from "vitest";

import {
  filterAgendaAppointments,
  filterAvailabilityRulesByLocation,
} from "@/core/booking/location-filters";
import { createLocationSchema, updateLocationSchema } from "@/core/validations/settings-schemas";

describe("filterAvailabilityRulesByLocation", () => {
  const rules = [
    { day_of_week: 1, location_id: null },
    { day_of_week: 2, location_id: "loc-a" },
    { day_of_week: 3, location_id: "loc-b" },
  ];

  it("returns all rules when no sede is selected", () => {
    expect(filterAvailabilityRulesByLocation(rules, null)).toHaveLength(3);
    expect(filterAvailabilityRulesByLocation(rules, "")).toHaveLength(3);
  });

  it("includes global rules and rules for the selected sede", () => {
    expect(filterAvailabilityRulesByLocation(rules, "loc-a")).toEqual([
      { day_of_week: 1, location_id: null },
      { day_of_week: 2, location_id: "loc-a" },
    ]);
  });
});

describe("filterAgendaAppointments", () => {
  const appointments = [
    {
      id: "1",
      professional_id: "pro-a",
      specialty_id: "spec-1",
      location_id: "loc-a",
    },
    {
      id: "2",
      professional_id: "pro-b",
      specialty_id: "spec-2",
      location_id: "loc-b",
    },
  ];

  it("filters by sede", () => {
    expect(filterAgendaAppointments(appointments, { locationId: "loc-a" })).toEqual([appointments[0]]);
  });

  it("combines professional and sede filters", () => {
    expect(
      filterAgendaAppointments(appointments, {
        professionalId: "pro-b",
        locationId: "loc-b",
      })
    ).toEqual([appointments[1]]);
  });
});

describe("location schemas", () => {
  it("validates createLocation with optional phone", () => {
    expect(
      createLocationSchema.safeParse({ name: "Sede Norte", address: "Av. 1", phone: "011" }).success
    ).toBe(true);
  });

  it("rejects empty location name", () => {
    expect(createLocationSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts updateLocation with same shape as create", () => {
    expect(updateLocationSchema.safeParse({ name: "Centro", phone: "123" }).success).toBe(true);
  });
});
