import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

const { updateTag } = vi.hoisted(() => ({
  updateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
  updateTag,
}));

import { revalidatePamiCabeceraSurfaces } from "@/core/cache/revalidate-pami-cabecera";

const CLINIC_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("revalidatePamiCabeceraSurfaces", () => {
  beforeEach(() => {
    revalidatePath.mockClear();
    updateTag.mockClear();
  });

  it("invalidates clinical templates and specialties tags", () => {
    revalidatePamiCabeceraSurfaces(CLINIC_ID);

    expect(updateTag).toHaveBeenCalledTimes(2);
    expect(updateTag).toHaveBeenCalledWith(`clinic-${CLINIC_ID}-clinical-templates`);
    expect(updateTag).toHaveBeenCalledWith(`clinic-${CLINIC_ID}-specialties`);
  });

  it("revalidates only pages that read clinic PAMI profile fields", () => {
    revalidatePamiCabeceraSurfaces(CLINIC_ID);

    expect(revalidatePath).toHaveBeenCalledTimes(3);
    expect(revalidatePath).toHaveBeenCalledWith("/configuracion", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/guia-pami", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/pacientes/nuevo", "page");
  });

  it("does not invalidate dashboard, historias list or historias/nueva page", () => {
    revalidatePamiCabeceraSurfaces(CLINIC_ID);

    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).not.toContain("/dashboard");
    expect(paths).not.toContain("/historias");
    expect(paths).not.toContain("/historias/nueva");
    expect(paths).not.toContain("/pacientes");
  });
});
