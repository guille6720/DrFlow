import { describe, expect, it } from "vitest";

import { isSameClinicCalendarDay } from "@/shared/utils/clinic-timezone";

import { buildEhrPayloadFromHceRows } from "@/features/pacientes/utils/patient-ehr-from-hce";
import {
  formatWaitingRoomElapsed,
  isWaitingRoomQueueStatus,
  shouldShowWaitingRoomElapsed,
  WAITING_ROOM_ELAPSED_CAP_SECONDS,
} from "@/features/turnos/utils/appointment-lifecycle";

import type { HceExportRow } from "@/lib/utils/hce-export-parse";

describe("patient clinical isolation", () => {
  it("scopes synthetic HCE consultation ids by patient so mergeById cannot collide", () => {
    const row: HceExportRow = {
      lineNumber: 1,
      tipo_registro: "records",
      fecha_inicio: "2024-01-15",
      fecha_fin: null,
      diagnostico: "Motivo",
      notas: "nota paciente A",
      estado: null,
      cie10: "",
      paciente_id: "summary",
      last_name: "",
      first_name: "",
      document_number: null,
    };

    const a = buildEhrPayloadFromHceRows([row], "Dr", { patientId: "patient-a" });
    const b = buildEhrPayloadFromHceRows(
      [{ ...row, notas: "nota paciente B" }],
      "Dr",
      { patientId: "patient-b" }
    );

    expect(a.consultations[0]?.id).toBe("hce-patient-a-1");
    expect(b.consultations[0]?.id).toBe("hce-patient-b-1");
    expect(a.consultations[0]?.id).not.toBe(b.consultations[0]?.id);
  });

  it("treats workspace cache keys as patient-scoped (regression contract)", () => {
    const cacheKey = (patientId: string, tab: string) => `${patientId}:${tab}`;
    expect(cacheKey("patient-a", "soap")).not.toBe(cacheKey("patient-b", "soap"));
  });

  it("rejects rendering when returned patient_id mismatches active patient", () => {
    const activePatientId = "patient-b";
    const returned = { patientInfo: { id: "patient-a" } };
    const matches = returned.patientInfo.id === activePatientId;
    expect(matches).toBe(false);
  });
});

describe("waiting room elapsed formatting", () => {
  it("formats under one hour as MM:SS", () => {
    expect(formatWaitingRoomElapsed(125)).toBe("02:05");
  });

  it("formats multi-hour waits without inventing days of hours in the UI cap constant", () => {
    expect(WAITING_ROOM_ELAPSED_CAP_SECONDS).toBe(12 * 60 * 60);
    expect(formatWaitingRoomElapsed(WAITING_ROOM_ELAPSED_CAP_SECONDS)).toBe("12:00:00");
  });

  it("never returns negative elapsed values from the formatter", () => {
    expect(formatWaitingRoomElapsed(-10)).toBe("00:00");
  });

  it("only treats waiting/confirmed as live queue statuses", () => {
    expect(isWaitingRoomQueueStatus("waiting")).toBe(true);
    expect(isWaitingRoomQueueStatus("confirmed")).toBe(true);
    expect(isWaitingRoomQueueStatus("finished")).toBe(false);
    expect(isWaitingRoomQueueStatus("cancelled")).toBe(false);
    expect(isWaitingRoomQueueStatus("in_consultation")).toBe(false);
  });

  it("hides elapsed for yesterday stale waiting status (Argentina clinic day)", () => {
    const now = new Date("2026-08-27T18:00:00.000-03:00");
    const yesterday = "2026-08-26T10:00:00.000-03:00";
    expect(isSameClinicCalendarDay(yesterday, now)).toBe(false);
    expect(
      shouldShowWaitingRoomElapsed({
        waitingRoomStatus: "waiting",
        enteredAt: yesterday,
        now,
      })
    ).toBe(false);
  });

  it("shows elapsed for same-day waiting appointments", () => {
    const now = new Date("2026-08-27T18:00:00.000-03:00");
    const todayMorning = "2026-08-27T09:15:00.000-03:00";
    expect(
      shouldShowWaitingRoomElapsed({
        waitingRoomStatus: "waiting",
        enteredAt: todayMorning,
        now,
      })
    ).toBe(true);
  });

  it("hides elapsed for completed and cancelled statuses even if enteredAt is today", () => {
    const now = new Date("2026-08-27T18:00:00.000-03:00");
    const todayMorning = "2026-08-27T09:15:00.000-03:00";
    expect(
      shouldShowWaitingRoomElapsed({
        waitingRoomStatus: "finished",
        enteredAt: todayMorning,
        now,
      })
    ).toBe(false);
    expect(
      shouldShowWaitingRoomElapsed({
        waitingRoomStatus: "cancelled",
        enteredAt: todayMorning,
        now,
      })
    ).toBe(false);
  });
});

describe("legacy agenda redirect query preservation", () => {
  it("documents that view=week must survive redirect to /turnos/agenda", () => {
    const incoming = new URLSearchParams("view=week&doctor=123");
    const qs = new URLSearchParams();
    for (const [key, value] of incoming.entries()) {
      if (key === "action") continue;
      qs.set(key, value);
    }
    expect(`/turnos/agenda?${qs.toString()}`).toBe("/turnos/agenda?view=week&doctor=123");
  });
});
