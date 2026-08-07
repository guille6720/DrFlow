import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

import { revalidateMedicalOrderSurfaces } from "@/core/cache/revalidate-medical-order-surfaces";

describe("revalidateMedicalOrderSurfaces", () => {
  beforeEach(() => {
    revalidatePath.mockClear();
  });

  it("invalidates only the patient workspace when there is no linked consulta", () => {
    revalidateMedicalOrderSurfaces({ patientId: "pat-1" });

    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/pacientes/pat-1", "page");
  });

  it("invalidates patient workspace and linked consulta embed", () => {
    revalidateMedicalOrderSurfaces({
      patientId: "pat-1",
      clinicalRecordId: "rec-1",
    });

    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/pacientes/pat-1", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/historias/rec-1", "page");
  });

  it("invalidates both consultas when clinical_record_id changes", () => {
    revalidateMedicalOrderSurfaces({
      patientId: "pat-1",
      clinicalRecordId: "rec-new",
      previousClinicalRecordId: "rec-old",
    });

    expect(revalidatePath).toHaveBeenCalledTimes(3);
    expect(revalidatePath).toHaveBeenCalledWith("/pacientes/pat-1", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/historias/rec-new", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/historias/rec-old", "page");
  });

  it("invalidates both patients when patient_id changes", () => {
    revalidateMedicalOrderSurfaces({
      patientId: "pat-new",
      previousPatientId: "pat-old",
    });

    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/pacientes/pat-new", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/pacientes/pat-old", "page");
  });

  it("does not touch list routes or /recetas", () => {
    revalidateMedicalOrderSurfaces({
      patientId: "pat-1",
      clinicalRecordId: "rec-1",
    });

    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).not.toContain("/pacientes");
    expect(paths).not.toContain("/historias");
    expect(paths).not.toContain("/recetas");
  });
});
