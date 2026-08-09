import { describe, expect, it } from "vitest";

import { buildAppointmentNotificationMessage } from "@/core/notifications/appointment-notification-message";

import {
  mapPortalAppointmentToRequestItem,
  mergePatientRequestItems,
} from "@/features/portal/utils/patient-portal-appointments";

describe("mapPortalAppointmentToRequestItem", () => {
  it("maps server appointment rows for portal UI", () => {
    const item = mapPortalAppointmentToRequestItem({
      appointmentId: "appt-1",
      status: "confirmed",
      startAt: "2026-08-10T16:00:00.000Z",
      endAt: "2026-08-10T16:30:00.000Z",
      bookingSource: "online",
      cancellationReason: null,
      cancelledAt: null,
      cancelledByType: null,
      professionalName: "Dr. Test",
      patientName: "Ana Paciente",
      createdAt: "2026-08-01T10:00:00.000Z",
    });

    expect(item.id).toBe("appt-1");
    expect(item.channel).toBe("web");
    expect(item.status).toBe("confirmed");
    expect(item.professionalName).toBe("Dr. Test");
  });
});

describe("mergePatientRequestItems", () => {
  it("keeps whatsapp-only requests and dedupes server appointments", () => {
    const merged = mergePatientRequestItems(
      [
        {
          id: "appt-1",
          appointmentId: "appt-1",
          type: "turno",
          channel: "web",
          patientName: "Ana",
          createdAt: "2026-08-10T10:00:00.000Z",
          status: "confirmed",
        },
      ],
      [
        {
          id: "local-1",
          type: "receta",
          channel: "whatsapp",
          patientName: "Ana",
          createdAt: "2026-08-09T10:00:00.000Z",
        },
        {
          id: "appt-1",
          appointmentId: "appt-1",
          type: "turno",
          channel: "web",
          patientName: "Ana",
          createdAt: "2026-08-08T10:00:00.000Z",
        },
      ]
    );

    expect(merged).toHaveLength(2);
    expect(merged.some((item) => item.channel === "whatsapp")).toBe(true);
  });
});

describe("buildAppointmentNotificationMessage", () => {
  it("builds confirmation copy", () => {
    const message = buildAppointmentNotificationMessage({
      eventType: "confirmation",
      channel: "email",
      payload: {
        patient_name: "Ana",
        professional_name: "Dr. Test",
        clinic_name: "Centro Médico",
        start_at: "2026-08-10T16:00:00.000Z",
      },
    });

    expect(message.subject).toContain("Centro Médico");
    expect(message.text).toContain("Ana");
    expect(message.text).toContain("Dr. Test");
  });
});
