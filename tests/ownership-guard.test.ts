import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/core/repositories/types";
import {
  verifyAppointmentForeignKeys,
  verifyAppointmentPatientMatch,
  verifyCashChargeForeignKeys,
  verifyClinicalRecordForeignKeys,
  verifyPatientInClinic,
  verifyPrescriptionForeignKeys,
} from "@/core/security/ownership-guard";

function mockDb(responses: Record<string, unknown | null>) {
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(function eq(this: unknown, _col: string, id: string) {
        return {
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: responses[`${table}:${id}`] ?? null })),
          })),
          maybeSingle: vi.fn(async () => ({ data: responses[`${table}:${id}`] ?? null })),
        };
      }),
    })),
  }));

  return { from } as unknown as DbClient;
}

describe("ownership-guard", () => {
  const clinicId = "11111111-1111-4111-8111-111111111111";
  const patientId = "22222222-2222-4222-8222-222222222222";
  const otherPatientId = "33333333-3333-4333-8333-333333333333";
  const professionalId = "44444444-4444-4444-8444-444444444444";
  const appointmentId = "55555555-5555-4555-8555-555555555555";

  it("accepts patient in active clinic", async () => {
    const db = mockDb({ [`patients:${patientId}`]: { id: patientId } });
    await expect(verifyPatientInClinic(db, clinicId, patientId)).resolves.toEqual({ ok: true });
  });

  it("rejects patient from another clinic", async () => {
    const db = mockDb({});
    const result = await verifyPatientInClinic(db, clinicId, patientId);
    expect(result).toEqual({
      ok: false,
      error: "Paciente no pertenece al consultorio activo",
    });
  });

  it("rejects appointment whose patient does not match payload", async () => {
    const db = mockDb({
      [`appointments:${appointmentId}`]: { patient_id: otherPatientId },
    });
    const result = await verifyAppointmentPatientMatch(db, clinicId, appointmentId, patientId);
    expect(result).toEqual({
      ok: false,
      error: "El turno no corresponde al paciente indicado",
    });
  });

  it("validates clinical record foreign keys including appointment match", async () => {
    const db = mockDb({
      [`patients:${patientId}`]: { id: patientId },
      [`professionals:${professionalId}`]: { id: professionalId },
      [`appointments:${appointmentId}`]: { patient_id: patientId },
    });

    const result = await verifyClinicalRecordForeignKeys(db, clinicId, {
      patientId,
      professionalId,
      appointmentId,
    });
    expect(result).toEqual({ ok: true });
  });

  it("validates appointment foreign keys", async () => {
    const db = mockDb({
      [`patients:${patientId}`]: { id: patientId },
      [`professionals:${professionalId}`]: { id: professionalId },
    });

    const result = await verifyAppointmentForeignKeys(db, clinicId, {
      patientId,
      professionalId,
    });
    expect(result).toEqual({ ok: true });
  });

  it("validates cash charge foreign keys with optional professional", async () => {
    const db = mockDb({
      [`patients:${patientId}`]: { id: patientId },
      [`professionals:${professionalId}`]: { id: professionalId },
      [`appointments:${appointmentId}`]: { patient_id: patientId },
    });

    const result = await verifyCashChargeForeignKeys(db, clinicId, {
      patientId,
      professionalId,
      appointmentId,
    });
    expect(result).toEqual({ ok: true });
  });

  it("validates prescription foreign keys", async () => {
    const recordId = "66666666-6666-4666-8666-666666666666";
    const db = mockDb({
      [`patients:${patientId}`]: { id: patientId },
      [`professionals:${professionalId}`]: { id: professionalId },
      [`clinical_records:${recordId}`]: { id: recordId },
    });

    const result = await verifyPrescriptionForeignKeys(db, clinicId, {
      patientId,
      professionalId,
      clinicalRecordId: recordId,
    });
    expect(result).toEqual({ ok: true });
  });
});
