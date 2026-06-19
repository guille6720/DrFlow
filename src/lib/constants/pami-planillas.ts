/* Planillas y solicitudes PAMI — cabecera */

export type PamiPlanillaCategory =
  | "internacion_domiciliaria"
  | "geriatrico"
  | "insumos"
  | "nutricion"
  | "kinesiologia_domiciliaria"
  | "oxigenoterapia"
  | "cuidados_paliativos";

export const PAMI_PLANILLA_CATEGORIES: {
  id: PamiPlanillaCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "internacion_domiciliaria",
    label: "Internación domiciliaria",
    description: "Solicitud de internación domiciliaria PAMI (módulo ID)",
  },
  {
    id: "geriatrico",
    label: "Programa geriátrico",
    description: "Evaluación geriátrica / seguimiento domiciliario",
  },
  {
    id: "insumos",
    label: "Insumos y material",
    description: "Pañales, gasas, sondas, material descartable",
  },
  {
    id: "nutricion",
    label: "Nutrición enteral",
    description: "Suplementos, fórmulas, SNG / gastrostomía",
  },
  {
    id: "kinesiologia_domiciliaria",
    label: "Kinesiología domiciliaria",
    description: "Sesiones kinésicas en domicilio",
  },
  {
    id: "oxigenoterapia",
    label: "Oxigenoterapia",
    description: "Concentrador, tubo de oxígeno, recarga",
  },
  {
    id: "cuidados_paliativos",
    label: "Cuidados paliativos",
    description: "Acompañamiento y cuidados en domicilio",
  },
];

export interface PamiPlanillaTemplate {
  id: string;
  category: PamiPlanillaCategory;
  title: string;
  /** Texto base; reemplazar {{campo}} con valores del formulario */
  template: string;
  fields: { key: string; label: string; multiline?: boolean; placeholder?: string }[];
}

export const PAMI_PLANILLA_TEMPLATES: PamiPlanillaTemplate[] = [
  {
    id: "id-inicial",
    category: "internacion_domiciliaria",
    title: "Internación domiciliaria — solicitud inicial",
    fields: [
      { key: "motivo", label: "Motivo de internación", multiline: true, placeholder: "EPOC descompensado, post operatorio..." },
      { key: "diagnostico", label: "Diagnóstico principal (CIE-10)", placeholder: "J44.1 / Z51.1..." },
      { key: "cuidador", label: "Cuidador responsable en domicilio", placeholder: "Familiar / cuidador PAMI" },
      { key: "domicilio", label: "Domicilio de internación", multiline: true },
      { key: "plan", label: "Plan terapéutico domiciliario", multiline: true, placeholder: "Oxigenoterapia, antibiótico EV domiciliario, controles..." },
    ],
    template: `SOLICITUD DE INTERNACIÓN DOMICILIARIA — PAMI

Paciente: {{paciente_nombre}}
DNI: {{paciente_dni}} | N° afiliado PAMI: {{paciente_pami}}

Diagnóstico: {{diagnostico}}
Motivo de internación domiciliaria: {{motivo}}

Domicilio de internación: {{domicilio}}
Cuidador responsable: {{cuidador}}

Plan terapéutico propuesto:
{{plan}}

Solicito autorización de módulo de Internación Domiciliaria PAMI.
Médico de cabecera: {{profesional}} — Mat. {{matricula}}`,
  },
  {
    id: "id-seguimiento",
    category: "internacion_domiciliaria",
    title: "Internación domiciliaria — seguimiento / prórroga",
    fields: [
      { key: "evolucion", label: "Evolución clínica", multiline: true },
      { key: "justificacion", label: "Justificación de prórroga", multiline: true },
    ],
    template: `SEGUIMIENTO / PRÓRROGA — INTERNACIÓN DOMICILIARIA PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Evolución: {{evolucion}}

Justificación de continuidad: {{justificacion}}

Solicito prórroga del módulo de Internación Domiciliaria.
{{profesional}} — Mat. {{matricula}}`,
  },
  {
    id: "geriatrico-eval",
    category: "geriatrico",
    title: "Evaluación geriátrica integral",
    fields: [
      { key: "motivo", label: "Motivo de consulta geriátrica", multiline: true },
      { key: "dependencia", label: "Nivel de dependencia (Barthel / observaciones)", multiline: true },
      { key: "riesgo_caidas", label: "Riesgo de caídas / cognición", multiline: true },
      { key: "plan", label: "Plan geriátrico", multiline: true, placeholder: "Controles, medicación, derivaciones..." },
    ],
    template: `SOLICITUD PROGRAMA GERIÁTRICO — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Motivo: {{motivo}}

Evaluación funcional / dependencia:
{{dependencia}}

Riesgo de caídas / estado cognitivo:
{{riesgo_caidas}}

Plan geriátrico propuesto:
{{plan}}

Solicito ingreso / seguimiento en módulo geriátrico PAMI.
{{profesional}} — Mat. {{matricula}}`,
  },
  {
    id: "insumos-panales",
    category: "insumos",
    title: "Insumos — pañales / material descartable",
    fields: [
      { key: "insumos", label: "Insumos solicitados", multiline: true, placeholder: "Pañales talle M, 120 u/mes; guantes..." },
      { key: "justificacion", label: "Justificación clínica", multiline: true, placeholder: "Incontinencia urinaria, encamamiento..." },
      { key: "cantidad", label: "Cantidad / periodicidad", placeholder: "120 unidades mensuales" },
    ],
    template: `SOLICITUD DE INSUMOS — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Insumos solicitados:
{{insumos}}

Cantidad / periodicidad: {{cantidad}}

Justificación clínica:
{{justificacion}}

{{profesional}} — Mat. {{matricula}}`,
  },
  {
    id: "insumos-sonda",
    category: "insumos",
    title: "Insumos — sonda / catéter / oxígeno portátil",
    fields: [
      { key: "insumos", label: "Detalle del insumo", multiline: true },
      { key: "justificacion", label: "Indicación médica", multiline: true },
    ],
    template: `SOLICITUD DE INSUMO MÉDICO — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Insumo / material: {{insumos}}

Indicación: {{justificacion}}

{{profesional}} — Mat. {{matricula}}`,
  },
  {
    id: "nutricion-enteral",
    category: "nutricion",
    title: "Nutrición enteral / suplementos",
    fields: [
      { key: "formula", label: "Fórmula / suplemento", placeholder: "Ensure, Nutrison..." },
      { key: "via", label: "Vía de administración", placeholder: "SNG / oral / gastrostomía" },
      { key: "cantidad", label: "Cantidad mensual", placeholder: "30 sobres / 60 frascos" },
      { key: "justificacion", label: "Justificación", multiline: true },
    ],
    template: `SOLICITUD NUTRICIÓN ENTERAL — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Fórmula / suplemento: {{formula}}
Vía: {{via}}
Cantidad: {{cantidad}}

Justificación clínica: {{justificacion}}

{{profesional}} — Mat. {{matricula}}`,
  },
  {
    id: "kine-domicilio",
    category: "kinesiologia_domiciliaria",
    title: "Kinesiología domiciliaria",
    fields: [
      { key: "diagnostico", label: "Diagnóstico / motivo", multiline: true },
      { key: "sesiones", label: "Cantidad de sesiones solicitadas", placeholder: "20 sesiones / 2 por semana" },
      { key: "objetivo", label: "Objetivo terapéutico", multiline: true },
    ],
    template: `SOLICITUD KINESIOLOGÍA DOMICILIARIA — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Diagnóstico: {{diagnostico}}

Objetivo: {{objetivo}}
Sesiones solicitadas: {{sesiones}}

Domicilio de atención: {{domicilio_paciente}}

{{profesional}} — Mat. {{matricula}}`,
  },
  {
    id: "oxigeno",
    category: "oxigenoterapia",
    title: "Oxigenoterapia domiciliaria",
    fields: [
      { key: "indicacion", label: "Indicación (Sat O2, EPOC, IC...)", multiline: true },
      { key: "flujo", label: "Flujo / horas por día", placeholder: "2 L/min — 12 hs/día" },
      { key: "equipo", label: "Equipo solicitado", placeholder: "Concentrador + tubo de reserva" },
    ],
    template: `SOLICITUD OXIGENOTERAPIA DOMICILIARIA — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Indicación: {{indicacion}}
Flujo y tiempo: {{flujo}}
Equipo: {{equipo}}

{{profesional}} — Mat. {{matricula}}`,
  },
  {
    id: "paliativos",
    category: "cuidados_paliativos",
    title: "Cuidados paliativos domiciliarios",
    fields: [
      { key: "diagnostico", label: "Diagnóstico / estadio", multiline: true },
      { key: "sintomas", label: "Control de síntomas", multiline: true },
      { key: "plan", label: "Plan de cuidados", multiline: true },
    ],
    template: `SOLICITUD CUIDADOS PALIATIVOS — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Diagnóstico: {{diagnostico}}

Control de síntomas: {{sintomas}}

Plan de cuidados domiciliarios:
{{plan}}

{{profesional}} — Mat. {{matricula}}`,
  },
];

export function renderPamiPlanilla(
  template: PamiPlanillaTemplate,
  values: Record<string, string>,
  ctx: {
    patientName: string;
    patientDni: string;
    patientPami: string;
    professionalName: string;
    licenseNumber: string;
    patientAddress?: string;
  }
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
