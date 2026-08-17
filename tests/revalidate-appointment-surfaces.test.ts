import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

import { revalidateAppointmentSurfaces } from "@/core/cache/revalidate-appointment-surfaces";

describe("revalidateAppointmentSurfaces", () => {
  beforeEach(() => {
    revalidatePath.mockClear();
  });

  it("invalidates agenda and dashboard without redirect stubs", () => {
    revalidateAppointmentSurfaces();

    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).toEqual(["/turnos/agenda", "/dashboard"]);
    expect(paths).not.toContain("/agenda");
    expect(paths).not.toContain("/turnos/nuevo");
    expect(paths).not.toContain("/atenciones");
  });

  it("adds the patient workspace when provided", () => {
    revalidateAppointmentSurfaces({ patientId: "pat-1" });

    expect(revalidatePath).toHaveBeenCalledWith("/pacientes/pat-1", "page");
  });

  it("adds the attendance register only when the visit was attended", () => {
    revalidateAppointmentSurfaces({ includeAttendanceRegister: true });

    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).toContain("/atenciones");
  });

  it("adds consultas and waiting-room when the queue changed", () => {
    revalidateAppointmentSurfaces({
      includeConsultasQueue: true,
      includeWaitingRoom: true,
    });

    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).toContain("/consultas");
    expect(paths).toContain("/sala-espera");
  });
});
