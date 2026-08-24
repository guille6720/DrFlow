import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

import { revalidatePrescriptionSurfaces } from "@/core/cache/revalidate-prescription-surfaces";

describe("revalidatePrescriptionSurfaces", () => {
  beforeEach(() => {
    revalidatePath.mockClear();
  });

  it("invalidates only the patient workspace when there is no linked consulta", () => {
    revalidatePrescriptionSurfaces({ patientId: "pat-1" });

    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/pacientes/pat-1", "page");
  });

  it("invalidates patient workspace and linked consulta embed", () => {
    revalidatePrescriptionSurfaces({
      patientId: "pat-1",
      clinicalRecordId: "rec-1",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/pacientes/pat-1", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/historias/rec-1", "page");
  });

  it("does not touch list routes, consultas, or the /recetas redirect", () => {
    revalidatePrescriptionSurfaces({
      patientId: "pat-1",
      clinicalRecordId: "rec-1",
    });

    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).not.toContain("/pacientes");
    expect(paths).not.toContain("/historias");
    expect(paths).not.toContain("/recetas");
    expect(paths).not.toContain("/consultas");
  });
});
