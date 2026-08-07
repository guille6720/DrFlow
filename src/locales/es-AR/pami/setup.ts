/** PAMI cabecera setup panel and server success messages. */
export const pamiSetupMessages = {
  panel: {
    title: "Consultorio PAMI — médico de cabecera",
    description:
      "Activa plantillas clínicas para HTA, DM2, EPOC, renovación de medicación, motivos de consulta frecuentes y turnos de 20 minutos. Pacientes nuevos se cargan con cobertura PAMI.",
    activeStatus: (insurance: string) => `Perfil activo · Cobertura por defecto: ${insurance}`,
    activeHint: "Plantillas en Nueva consulta · Estudios y derivaciones en Historia clínica",
    inactiveStatus: "Todavía no configuraste el perfil PAMI cabecera para esta clínica.",
    activateButton: "Activar consultorio PAMI cabecera",
    updateButton: "Actualizar perfil PAMI",
    activateAria: "Activar consultorio PAMI cabecera",
    updateAria: "Actualizar perfil PAMI cabecera",
    configuringAria: "Configurando perfil PAMI",
    successFallback: "Perfil PAMI activado.",
    errorFallback: "No se pudo configurar el perfil PAMI. Intentá de nuevo.",
    defaultInsurance: "PAMI",
  },
  seed: {
    alreadyConfigured: "El consultorio PAMI ya estaba configurado. No se realizaron cambios.",
    profileUpdated: "Perfil PAMI actualizado. Turnos de 20 min y cobertura PAMI confirmados.",
    readyPrefix: "Consultorio PAMI listo",
    templatesAdded: (count: number) =>
      `${count} plantilla${count === 1 ? "" : "s"} clínica${count === 1 ? "" : "s"} nueva${count === 1 ? "" : "s"}`,
    reasonsAdded: (count: number) =>
      `${count} motivo${count === 1 ? "" : "s"} de consulta nuevo${count === 1 ? "" : "s"}`,
    slotMinutes: "turnos de 20 min",
    defaultCoverage: "cobertura PAMI por defecto",
    configureError: "No se pudo configurar el perfil PAMI.",
  },
} as const;
