import { revalidatePath } from "next/cache";

export type AppointmentRevalidationContext = {
  patientId?: string | null;
  /** Registro de atenciones — solo si el turno quedó atendido. */
  includeAttendanceRegister?: boolean;
  /** Cola de /consultas (sala de espera / finalizar). */
  includeConsultasQueue?: boolean;
  includeWaitingRoom?: boolean;
};

/**
 * Invalidate appointment UI surfaces.
 * Skips redirect stubs (`/agenda`) and form routes (`/turnos/nuevo`).
 */
export function revalidateAppointmentSurfaces(ctx: AppointmentRevalidationContext = {}): void {
  revalidatePath("/turnos/agenda", "page");
  revalidatePath("/dashboard", "page");
  if (ctx.patientId) {
    revalidatePath(`/pacientes/${ctx.patientId}`, "page");
  }
  if (ctx.includeAttendanceRegister) {
    revalidatePath("/atenciones", "page");
  }
  if (ctx.includeConsultasQueue) {
    revalidatePath("/consultas", "page");
  }
  if (ctx.includeWaitingRoom) {
    revalidatePath("/sala-espera", "page");
  }
}
