import { describe, expect, it } from "vitest";

import {
  canSetAgendaAttendance,
  formatCancellationReason,
  resolveAgendaAttendanceValue,
  resolveAppointmentLifecycleLabel,
} from "@/features/turnos/utils/appointment-lifecycle";
import { turnoWizardSchema } from "@/features/turnos/utils/turno-wizard-schema";
import { computeTurnosDashboardMetrics } from "@/features/turnos/utils/turnos-metrics";

describe("resolveAppointmentLifecycleLabel", () => {
  it("maps waiting room waiting to En espera", () => {
    expect(
      resolveAppointmentLifecycleLabel({
        status: "confirmed",
        waitingRoomStatus: "waiting",
      })
    ).toBe("En espera");
  });

  it("maps waiting room confirmed to Presente", () => {
    expect(
      resolveAppointmentLifecycleLabel({
        status: "confirmed",
        waitingRoomStatus: "confirmed",
      })
    ).toBe("Presente");
  });

  it("marks overbooking pending as Sobreturno", () => {
    expect(
      resolveAppointmentLifecycleLabel({
        status: "pending",
        isOverbooking: true,
      })
    ).toBe("Sobreturno");
  });

  it("marks rescheduled appointments", () => {
    expect(
      resolveAppointmentLifecycleLabel({
        status: "confirmed",
        rescheduledAt: "2026-08-10T12:00:00Z",
      })
    ).toBe("Reprogramado");
  });
});

describe("agenda attendance", () => {
  it("maps default waiting room to En espera", () => {
    expect(
      resolveAgendaAttendanceValue({
        status: "confirmed",
        waitingRoomStatus: "waiting",
      })
    ).toBe("waiting");
  });

  it("maps no_show to Ausente", () => {
    expect(
      resolveAgendaAttendanceValue({
        status: "no_show",
        waitingRoomStatus: null,
      })
    ).toBe("absent");
  });

  it("hides the selector after the consult starts", () => {
    expect(
      canSetAgendaAttendance({
        status: "confirmed",
        waitingRoomStatus: "in_consultation",
      })
    ).toBe(false);
  });
});

describe("formatCancellationReason", () => {
  it("combines category label and detail", () => {
    expect(formatCancellationReason("patient", "No puede asistir")).toBe(
      "Paciente: No puede asistir"
    );
  });
});

describe("computeTurnosDashboardMetrics", () => {
  it("computes today and rate metrics", () => {
    const now = new Date("2026-08-10T15:00:00.000Z");
    const metrics = computeTurnosDashboardMetrics({
      appointments: [
        {
          status: "confirmed",
          start_at: "2026-08-10T16:00:00.000Z",
          end_at: "2026-08-10T16:30:00.000Z",
        },
        {
          status: "cancelled",
          start_at: "2026-08-05T16:00:00.000Z",
          end_at: "2026-08-05T16:30:00.000Z",
        },
        {
          status: "attended",
          start_at: "2026-08-04T16:00:00.000Z",
          end_at: "2026-08-04T16:30:00.000Z",
        },
        {
          status: "no_show",
          start_at: "2026-08-03T16:00:00.000Z",
          end_at: "2026-08-03T16:30:00.000Z",
        },
      ],
      rules: [
        {
          day_of_week: 1,
          start_time: "09:00",
          end_time: "17:00",
          is_active: true,
        },
      ],
      freeSlotsToday: 4,
      professionalCounts: [{ professionalId: "p1", professionalName: "Dr. Test", count: 1 }],
      now,
    });

    expect(metrics.today.total).toBe(1);
    expect(metrics.today.confirmed).toBe(1);
    expect(metrics.last30Days.cancelled).toBe(1);
    expect(metrics.last7Days.freeSlotsToday).toBe(4);
  });
});

describe("turnoWizardSchema", () => {
  it("requires overbooking reason when flagged", () => {
    const result = turnoWizardSchema.safeParse({
      patient_id: "00000000-0000-4000-8000-000000000001",
      professional_id: "00000000-0000-4000-8000-000000000002",
      start_at: "2026-08-10T14:00:00.000Z",
      end_at: "2026-08-10T14:30:00.000Z",
      is_overbooking: true,
      overbooking_reason: "",
    });

    expect(result.success).toBe(false);
  });
});
