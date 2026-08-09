import { describe, expect, it } from "vitest";

import {
  formatCancellationReason,
  resolveAppointmentLifecycleLabel,
} from "@/features/turnos/utils/appointment-lifecycle";
import { turnoWizardSchema } from "@/features/turnos/utils/turno-wizard-schema";

describe("resolveAppointmentLifecycleLabel", () => {
  it("maps waiting room to Presente", () => {
    expect(
      resolveAppointmentLifecycleLabel({
        status: "confirmed",
        waitingRoomStatus: "waiting",
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

describe("formatCancellationReason", () => {
  it("combines category label and detail", () => {
    expect(formatCancellationReason("patient", "No puede asistir")).toBe(
      "Paciente: No puede asistir"
    );
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
