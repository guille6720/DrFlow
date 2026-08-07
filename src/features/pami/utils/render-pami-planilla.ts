import type {
  PamiPlanillaRenderContext,
  PamiPlanillaTemplate,
} from "@/features/pami/types/pami-planilla-template";

/** Renders a planilla template with patient/professional context. Contract unchanged. */
export function renderPamiPlanilla(
  template: PamiPlanillaTemplate,
  values: Record<string, string>,
  ctx: PamiPlanillaRenderContext
): string {
  const merged: Record<string, string> = {
    ...values,
    paciente_nombre: ctx.patientName,
    paciente_dni: ctx.patientDni,
    paciente_pami: ctx.patientPami || "—",
    profesional: ctx.professionalName,
    matricula: ctx.licenseNumber || "—",
    domicilio_paciente: ctx.patientAddress ?? values.domicilio ?? "—",
  };

  return template.template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => merged[key]?.trim() || "—");
}
