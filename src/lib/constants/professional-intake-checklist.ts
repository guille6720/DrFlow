/** Referencia de campos habituales en fichas de ingreso de médicos (Argentina). */

export type IntakeChecklistItem = {
  id: string;
  label: string;
  detail?: string;
  source?: string;
};

export const PROFESSIONAL_INTAKE_SECTIONS: {
  id: string;
  title: string;
  items: IntakeChecklistItem[];
}[] = [
  {
    id: "identidad",
    title: "Identificación del profesional",
    items: [
      { id: "nombre", label: "Apellido y nombre completos" },
      { id: "dni", label: "Documento nacional de identidad" },
      { id: "email", label: "Correo electrónico de contacto" },
      { id: "telefono", label: "Teléfono celular / fijo" },
      { id: "cuil", label: "CUIL / CUIT (AFIP)", detail: "Requerido para alta en obras sociales y facturación." },
    ],
  },
  {
    id: "matricula",
    title: "Matrícula y especialidad",
    items: [
      {
        id: "mn",
        label: "Matrícula nacional (RUPS / Ministerio de Salud)",
        source: "argentina.gob.ar — Registro Único de Profesionales de la Salud",
      },
      {
        id: "mp",
        label: "Matrícula provincial / colegio distrital",
        detail: "Obligatoria para ejercer en consultorio particular en la mayoría de las jurisdicciones.",
      },
      {
        id: "esp",
        label: "Especialidad acreditada",
        detail: "Título de especialista (Colegio de Médicos o Ministerio de Salud) o certificado de residencia.",
      },
    ],
  },
  {
    id: "consultorio",
    title: "Consultorio y habilitación",
    items: [
      {
        id: "domicilio",
        label: "Domicilio del consultorio",
        detail: "Debe coincidir con el declarado ante colegio / obra social.",
      },
      { id: "tel-cons", label: "Teléfono del consultorio" },
      {
        id: "habilitacion",
        label: "Habilitación del consultorio (Colegio de Médicos)",
        detail: "Inspección previa según distrito. En CABA también trámite TAD MSAL.",
      },
      {
        id: "poli",
        label: "Autorización en policonsultorio (si aplica)",
        detail: "Nota del titular + habilitación individual a nombre del profesional.",
      },
    ],
  },
  {
    id: "obras",
    title: "Alta en obras sociales / prepagas",
    items: [
      { id: "cuit", label: "Constancia de CUIT / AFIP" },
      { id: "iibb", label: "Ingresos brutos (cuando corresponda)" },
      { id: "etica", label: "Certificado de ética del Colegio de Médicos" },
      { id: "sssalud", label: "Inscripción SSSalud (superintendencia)" },
      { id: "cbu", label: "CBU para liquidaciones" },
      { id: "coberturas", label: "Obras sociales / prepagas en las que desea atender" },
    ],
  },
  {
    id: "agenda",
    title: "Modelo de agenda inicial",
    items: [
      { id: "dias", label: "Días y horario de atención (ej. Lun–Vie 09:00–18:00)" },
      { id: "duracion", label: "Duración del turno (20 / 30 / 45 min)" },
      { id: "sede", label: "Sede o consultorio asignado" },
      { id: "motivos", label: "Motivos de consulta habilitados" },
      { id: "bloqueos", label: "Bloqueos periódicos (vacaciones, guardias, etc.)" },
    ],
  },
];

export const AGENDA_PRESETS = [
  {
    id: "lun-vie-completo",
    label: "Lun–Vie · 09:00–18:00 · 30 min",
    rules: [1, 2, 3, 4, 5].map((day) => ({
      day_of_week: day,
      start_time: "09:00",
      end_time: "18:00",
      slot_duration: 30,
    })),
  },
  {
    id: "manana",
    label: "Lun–Vie · 08:00–13:00 · 30 min",
    rules: [1, 2, 3, 4, 5].map((day) => ({
      day_of_week: day,
      start_time: "08:00",
      end_time: "13:00",
      slot_duration: 30,
    })),
  },
  {
    id: "tarde",
    label: "Lun–Vie · 14:00–19:00 · 30 min",
    rules: [1, 2, 3, 4, 5].map((day) => ({
      day_of_week: day,
      start_time: "14:00",
      end_time: "19:00",
      slot_duration: 30,
    })),
  },
  {
    id: "sabado",
    label: "Sáb · 09:00–13:00 · 30 min",
    rules: [{ day_of_week: 6, start_time: "09:00", end_time: "13:00", slot_duration: 30 }],
  },
] as const;

export type AgendaRuleDraft = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

export const WEEKDAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};
