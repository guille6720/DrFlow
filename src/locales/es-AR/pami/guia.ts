/** Guía cabecera PAMI page content. */
export const pamiGuiaMessages = {
  page: {
    title: "Guía — médico de cabecera PAMI",
    subtitle: "Flujo diario recomendado para consultorio geriátrico",
  },
  alert: {
    notActivatedPrefix: "Todavía no activaste el perfil PAMI. Andá a",
    configurationLink: "Configuración",
    notActivatedSuffix: "y pulsá",
    activateButton: "Activar consultorio PAMI cabecera",
  },
  dailyFlow: {
    cardTitle: "Tu día en 4 pasos",
    stepAriaLabel: (step: string, title: string, desc: string) => `Paso ${step}: ${title}. ${desc}`,
    steps: [
      {
        step: "1",
        title: "Agenda del día",
        desc: "Vista día → confirmá turnos → Empezar consulta.",
        href: "/agenda?view=day",
      },
      {
        step: "2",
        title: "Consulta PAMI",
        desc: "Usá plantilla HTA / DM2 / renovación. Revisá alergias arriba.",
        href: "/historias/nueva",
      },
      {
        step: "3",
        title: "Planillas PAMI",
        desc: "Internación domiciliaria, geriátrico, insumos, oxígeno.",
        href: "/pami/planillas",
      },
      {
        step: "4",
        title: "Estudios o derivación",
        desc: "Chips rápidos: laboratorio, ECG, cardiólogo, kinesio.",
        href: "/historias",
      },
      {
        step: "5",
        title: "Receta + WhatsApp",
        desc: "Receta PDF Ley 25.649. Compartir al familiar del paciente.",
        href: "/recetas",
      },
    ],
  },
  comparison: {
    cardTitle: "Qué trae NexClinic vs otras apps",
    items: [
      {
        label: "Turneras",
        body: "agenda y recordatorios — NexClinic suma plantillas clínicas PAMI, estudios/derivaciones en 1 clic y guía por síntomas.",
      },
      {
        label: "MedicAI",
        body: "facturación OS/ARCA — NexClinic es más liviano para cabecera solo PAMI (sin liquidaciones por ahora).",
      },
      {
        label: "WhatsApp",
        body: "abre con mensaje listo (sin API) — ideal para secretaría o médico con pocos minutos.",
      },
    ],
  },
  checklist: {
    cardTitle: "Checklist antes del piloto",
    ariaLabel: "Checklist de preparación PAMI",
    items: [
      "Activar perfil PAMI en Configuración (plantillas + turnos 20 min)",
      "Cargar pacientes demo o fichas reales con N° beneficio PAMI",
      "Completar alergias y medicación habitual en cada ficha",
      "Probar recordatorio WhatsApp desde Recordatorios",
      "Revisar checklist QA en /qa antes del primer día real",
    ],
    configurationButton: "Configuración",
    configurationAria: "Ir a configuración del consultorio",
    qaButton: "Checklist QA",
    qaAria: "Abrir checklist de calidad",
  },
  patientData: {
    cardTitle: "Datos que el paciente PAMI debe traer",
    dniCredential: "DNI + credencial PAMI vigente",
    medication: "Medicación actual (cajas o listado)",
    caregiverPhone: "Teléfono del familiar / cuidador",
    newPatientLink: "Alta de paciente PAMI",
    newPatientAria: "Alta de paciente PAMI",
  },
} as const;
