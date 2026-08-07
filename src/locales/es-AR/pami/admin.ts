/** PAMI planillas admin catalog editor. */
export const pamiAdminMessages = {
  cardTitle: "Planillas PAMI — catálogo",
  infoBanner:
    "Editá plantillas, campos y versiones sin deploy. Los cambios se reflejan en /pami/planillas al instante. Cada guardado crea una versión nueva.",
  emptyCatalog:
    "No hay plantillas en la base de datos. Ejecutá las migraciones 079 y 080 en Supabase.",
  templatesListAria: "Plantillas PAMI configurables",
  inactiveBadge: "Inactiva",
  activeClinicLabel: "Activa en clínica",
  activateTemplateAria: (title: string) => `Activar plantilla ${title} en esta clínica`,
  globallyDisabled:
    "Esta plantilla está desactivada globalmente. Contactá al administrador del sistema.",
  bodyLabel: "Cuerpo de la plantilla",
  bodyHint:
    'Usá {{campo}} para placeholders. Contexto automático: paciente_nombre, paciente_dni, paciente_pami, profesional, matricula, domicilio_paciente.',
  dynamicFieldsTitle: "Campos dinámicos",
  addField: "Agregar campo",
  removeField: "Quitar campo",
  keyLabel: "Clave",
  labelLabel: "Etiqueta",
  placeholderLabel: "Placeholder",
  multilineLabel: "Multilínea",
  multilineAria: (label: string) => `Campo multilínea para ${label}`,
  changeNotesLabel: "Notas de cambio (opcional)",
  changeNotesPlaceholder: "Ej: Actualización normativa PAMI 2026",
  publishButton: "Publicar nueva versión",
  publishAriaLoading: "Publicando nueva versión de plantilla",
  publishAriaIdle: "Publicar nueva versión de plantilla",
  defaultFieldLabel: "Nuevo campo",
  activatedClinic: "Plantilla activada para esta clínica.",
  deactivatedClinic: "Plantilla desactivada para esta clínica.",
  versionPublished: (version: number) =>
    `Versión v${version} publicada. Visible en Planillas PAMI sin deploy.`,
} as const;
