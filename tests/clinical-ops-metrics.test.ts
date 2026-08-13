import { describe, expect, it } from "vitest";

import { isWaitingRoomCandidate } from "@/features/dashboard/server/load-clinical-operations-dashboard.helpers";
import type { LiveAppointment } from "@/features/dashboard/utils/clinical-operations-types";
import {
  buildActionableAlerts,
  computeActivityMetrics,
  computePatientAge,
  computeWaitingMinutes,
  enrichWaitingRows,
  isLikelyLabFile,
  prioritizeLabResults,
  summarizeMedications,
  waitingPriority,
} from "@/features/dashboard/utils/clinical-ops-metrics";

const NOW = new Date("2026-07-30T15:00:00.000Z");

describe("clinical-ops-metrics", () => {
  it("computes patient age from birth date", () => {
    expect(computePatientAge("1990-01-15", NOW)).toBe(36);
    expect(computePatientAge(null, NOW)).toBeNull();
  });

  it("computes waiting minutes from appointment start", () => {
    expect(computeWaitingMinutes("2026-07-30T14:30:00.000Z", NOW)).toBe(30);
    expect(computeWaitingMinutes("null", NOW)).toBe(0);
  });

  it("assigns urgent priority when allergies present", () => {
    expect(waitingPriority("2026-07-30T16:00:00.000Z", "waiting", true, NOW)).toBe("urgent");
    expect(waitingPriority("2026-07-30T14:00:00.000Z", "waiting", false, NOW)).toBe("high");
  });

  it("summarizes prescription medications", () => {
    expect(summarizeMedications([{ name: "Ibuprofeno" }, { name: "Paracetamol" }])).toBe(
      "Ibuprofeno +1"
    );
    expect(summarizeMedications([])).toBe("Sin medicación");
  });

  it("detects likely lab filenames", () => {
    expect(isLikelyLabFile("hemograma_completo.pdf")).toBe(true);
    expect(isLikelyLabFile("informe_cardiologico.pdf")).toBe(false);
  });

  it("prioritizes lab files in recent studies", () => {
    const sorted = prioritizeLabResults(
      [
        {
          id: "1",
          file_name: "informe.pdf",
          created_at: "2026-07-30T10:00:00.000Z",
          patient_id: "p1",
          patients: { first_name: "Ana", last_name: "García" },
        },
        {
          id: "2",
          file_name: "lab_glucosa.pdf",
          created_at: "2026-07-30T09:00:00.000Z",
          patient_id: "p2",
          patients: { first_name: "Luis", last_name: "Pérez" },
        },
      ],
      NOW
    );
    expect(sorted[0].isLab).toBe(true);
  });

  it("computes activity metrics for today", () => {
    const todayAppointments: LiveAppointment[] = [
      {
        id: "a1",
        start_at: "2026-07-30T14:00:00.000Z",
        status: "attended",
        patient_id: "p1",
      },
      {
        id: "a2",
        start_at: "2026-07-30T14:30:00.000Z",
        status: "confirmed",
        patient_id: "p2",
        waiting_room_status: "waiting",
      },
      {
        id: "a3",
        start_at: "2026-07-30T16:00:00.000Z",
        status: "confirmed",
        patient_id: "p3",
      },
    ];
    const waiting = todayAppointments.filter((a) => a.waiting_room_status === "waiting");
    const metrics = computeActivityMetrics({ todayAppointments, waiting, now: NOW });
    expect(metrics.attendedCount).toBe(1);
    expect(metrics.waitingCount).toBe(1);
    expect(metrics.delayedCount).toBe(1);
    expect(metrics.nextAppointment?.id).toBe("a3");
  });

  it("enriches waiting rows with allergies and priority", () => {
    const waiting: LiveAppointment[] = [
      {
        id: "w1",
        start_at: "2026-07-30T14:00:00.000Z",
        status: "confirmed",
        patient_id: "p1",
        waiting_room_status: "waiting",
        patients: {
          first_name: "Ana",
          last_name: "García",
          birth_date: "1985-06-01",
        },
      },
    ];
    const allergies = new Map([["p1", "Penicilina"]]);
    const rows = enrichWaitingRows({ waiting, allergiesByPatient: allergies, now: NOW });
    expect(rows[0].priority).toBe("urgent");
    expect(rows[0].allergies).toBe("Penicilina");
    expect(rows[0].waitingMinutes).toBeGreaterThan(0);
  });

  it("builds actionable alerts from overdue and critical patients", () => {
    const alerts = buildActionableAlerts({
      criticalPatients: [
        {
          id: "p1",
          first_name: "Ana",
          last_name: "García",
          reason: "Alergias: Penicilina",
        },
      ],
      overdue: [
        {
          id: "a1",
          start_at: "2026-07-30T13:00:00.000Z",
          status: "confirmed",
          patient_id: "p2",
          patients: { first_name: "Luis", last_name: "Pérez" },
        },
      ],
      enrichedWaiting: [],
    });
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts[0].severity).toBe("critical");
  });
});

describe("isWaitingRoomCandidate", () => {
  it("ignores a booked turno until check-in", () => {
    expect(
      isWaitingRoomCandidate({
        id: "a1",
        start_at: "2026-07-30T15:00:00.000Z",
        status: "confirmed",
        waiting_room_status: "waiting",
      })
    ).toBe(false);
  });

  it("includes Presente and En espera after check-in", () => {
    expect(
      isWaitingRoomCandidate({
        id: "a1",
        start_at: "2026-07-30T15:00:00.000Z",
        status: "confirmed",
        waiting_room_status: "waiting",
        waiting_room_entered_at: "2026-07-30T14:50:00.000Z",
      })
    ).toBe(true);
    expect(
      isWaitingRoomCandidate({
        id: "a2",
        start_at: "2026-07-30T15:00:00.000Z",
        status: "confirmed",
        waiting_room_status: "confirmed",
        waiting_room_entered_at: "2026-07-30T14:50:00.000Z",
      })
    ).toBe(true);
  });
});
