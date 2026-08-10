import { describe, expect, it } from "vitest";

import { normalizeClinicalOpsPayload } from "@/features/dashboard/utils/normalize-clinical-ops-payload";

describe("normalizeClinicalOpsPayload", () => {
  it("fills missing dashboard sections with safe defaults", () => {
    const normalized = normalizeClinicalOpsPayload({
      waiting: [],
      upcoming: [],
      overdue: [],
      draftPrescriptions: [],
      pendingStudies: [],
      criticalPatients: [],
      notifications: [],
      todayAppointments: [],
      tasks: [],
      activity: {
        waitingCount: 0,
        attendedCount: 0,
        averageWaitingMinutes: null,
        nextAppointment: null,
        delayedCount: 0,
      },
      enrichedWaiting: [],
      actionableAlerts: [],
      pendingOrders: [],
      recentLabs: [],
      urgentPatients: undefined as unknown as [],
    });

    expect(normalized.urgentPatients).toEqual([]);
    expect(normalized.pendingOrders).toEqual([]);
  });
});
