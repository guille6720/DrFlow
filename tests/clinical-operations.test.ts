import { describe, expect, it } from "vitest";

import type { LiveAppointment } from "@/features/dashboard/utils/clinical-operations-types";

function filterOverdue(queue: LiveAppointment[], nowIso: string): LiveAppointment[] {
  return queue.filter(
    (a) =>
      a.start_at < nowIso &&
      a.status !== "attended" &&
      a.status !== "cancelled" &&
      a.status !== "no_show"
  );
}

describe("clinical operations filters", () => {
  it("marks past pending appointments as overdue", () => {
    const queue: LiveAppointment[] = [
      {
        id: "1",
        start_at: "2026-08-03T10:00:00Z",
        status: "pending",
      },
      {
        id: "2",
        start_at: "2026-08-03T18:00:00Z",
        status: "pending",
      },
      {
        id: "3",
        start_at: "2026-08-03T09:00:00Z",
        status: "attended",
      },
    ];
    const overdue = filterOverdue(queue, "2026-08-03T12:00:00Z");
    expect(overdue.map((a) => a.id)).toEqual(["1"]);
  });
});
