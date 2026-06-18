/* PAMI medico de cabecera: perfiles, plantillas y estudios frecuentes */

export const PAMI_INSURANCE = "PAMI";
export const PAMI_PRACTICE_PROFILE = "cabecera_pami";
export const PAMI_DEFAULT_SLOT_MINUTES = 20;

export const PAMI_CONSULTATION_REASONS = [
  "Control crónico PAMI",
  "Consulta aguda",
  "Renovación medicación",
  "Pedido de estudios",
  "Derivación especialista",
  "Certificado / reposo",
] as const;

export const PAMI_STUDY_TEMPLATES: { label: string; text: string }[] = [
  {
    label: "Laboratorio básico",
    text: "Hemograma completo\nGlucemia en ayunas\nUrea y creatinina\nIonograma\nOrina completa",
  },
  {
    label: "Perfil metabólico",
    text: "Glucemia en ayunas\nHbA1c\nPerfil lipídico (CT, HDL, LDL, TG)\nUrea y creatinina\nMicroalbuminuria",
  },
  {
    label: "ECG",
    text: "Electrocardiograma de 12 derivaciones en reposo",
  },
  {
    label: "Rx tórax",
    text: "Radiografía de tórax PA y lateral",
  },
  {
    label: "Control HTA",
    text: "Electrocardiograma\nLaboratorio: hemograma, urea, creatinina, ionograma, orina completa",
  },
];

export const PAMI_REFERRAL_TEMPLATES: { label: string; text: string }[] = [
  {
    label: "Cardiología",
    text: "Derivación a Cardiología por evaluación de patología cardiovascular. Solicito interconsulta para estudio y tratamiento.",
  },
  {
    label: "Oftalmología",
    text: "Derivación a Oftalmología para evaluación visual completa. Paciente PAMI.",
  },
  {
    label: "Traumatología",
    text: "Derivación a Traumatología por cuadro osteoarticular. Solicito evaluación y tratamiento.",
  },
  {
    label: "Neurología",
    text: "Derivación a Neurología por síntomas neurológicos. Solicito estudio complementario.",
  },
  {
    label: "Kinesiología",
    text: "Derivación a Kinesiología / Rehabilitación. Solicito plan de tratamiento kinésico.",
  },
];

export const PAMI_CLINICAL_TEMPLATES: {
  name: string;
  chief_complaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
}[] = [
  {
    name: "Control HTA — PAMI",
    chief_complaint: "Control de hipertensión arterial. Refiere adherencia parcial al tratamiento.",
    diagnosis: "Hipertensión arterial esencial (I10)",
    evolution: "PA en consultorio elevada / en metas según registro. Sin signos de alarma.",
    indications: "Continuar tratamiento antihipertensivo. Dieta hiposódica. Control en 30 días. Pedir laboratorio si corresponde.",
  },
  {
    name: "Control DM2 — PAMI",
    chief_complaint: "Control de diabetes mellitus tipo 2.",
    diagnosis: "Diabetes mellitus tipo 2 (E11.9)",
    evolution: "Refiere controles domiciliarios variables. Revisión de medicación habitual.",
    indications: "Continuar hipoglucemiante oral / insulinización según pauta. Dieta y actividad física. Laboratorio: glucemia, HbA1c, perfil renal.",
  },
  {
    name: "Renovación medicación crónica",
    chief_complaint: "Solicita renovación de medicación de uso crónico.",
    diagnosis: "Enfermedades crónicas en tratamiento — control de cabecera PAMI",
    evolution: "Paciente estable. Sin efectos adversos referidos. Adherencia aceptable.",
    indications: "Renovar medicación habitual por 30 días. Control en consultorio según cronograma PAMI.",
  },
  {
    name: "Consulta aguda — síntomas respiratorios",
    chief_complaint: "Cuadro respiratorio de ___ días de evolución: tos, rinorrea / disnea.",
    diagnosis: "Infección respiratoria aguda superior (J06.9) — a confirmar",
    evolution: "Afebril / febril. Sat O2 adecuada. Auscultación sin agregados / con crepitantes.",
    indications: "Hidratación. Sintomáticos. Control en 48-72 hs si empeora. Estudios si criterio de gravedad.",
  },
  {
    name: "Control EPOC / asma",
    chief_complaint: "Control de enfermedad respiratoria crónica. Disnea de esfuerzo.",
    diagnosis: "EPOC (J44.9) / Asma (J45.9) — según antecedente",
    evolution: "Disnea estable / exacerbación leve. Uso de broncodilatador según necesidad.",
    indications: "Continuar tratamiento inhalatorio. Vacunación antigripal/antineumocócica al día. Control en 60 días.",
  },
];

export function buildPamiReminderMessage(
  patientName: string,
  dateLabel: string,
  professionalName: string,
  clinicName: string
): string {
  return (
    `Hola ${patientName}, le recordamos su turno de PAMI el ${dateLabel} con ${professionalName}. ` +
    `Consultorio: ${clinicName}. ` +
    `Traiga DNI, credencial PAMI y medicación actual. ` +
    `Ante cancelación avise con anticipación. — DrFlow`
  );
}
