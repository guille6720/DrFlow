/** UI strings for the PAMI planillas workflow. */
export const pamiPlanillasMessages = {
  page: {
    title: "Planillas PAMI",
    subtitle: "Internación domiciliaria, geriátrico, insumos y solicitudes de cabecera",
  },
  search: {
    ariaLiveSearching: "Buscando pacientes PAMI…",
    formAriaLabel: "Buscar pacientes PAMI",
    label: "Buscar paciente PAMI",
    placeholder: "Nombre, apellido o DNI…",
    submit: "Buscar",
    submitAriaSearching: "Buscando pacientes PAMI",
    submitAriaIdle: "Buscar pacientes PAMI",
  },
  pagination: {
    navAriaLabel: "Paginación de pacientes PAMI",
    previous: "Anterior",
    next: "Siguiente",
    pagePreviousAria: (page: number) => `Página anterior, página ${page}`,
    pageNextAria: (page: number) => `Página siguiente, página ${page}`,
    patientsSuffix: (total: number) => `${total} pacientes PAMI`,
  },
  section: {
    completeFormAriaLabel: "Completar planilla PAMI",
  },
  category: {
    cardTitle: "Tipo de solicitud PAMI",
    legendSrOnly: "Tipo de solicitud PAMI",
    optionAriaLabel: (label: string, description: string) => `${label}. ${description}`,
  },
  fields: {
    cardTitle: "Completar planilla",
    templateLabel: "Plantilla",
    patientLabel: "Paciente PAMI",
    patientPlaceholder: "Seleccionar paciente",
    patientOptionLabel: (lastName: string, firstName: string, dni: string) =>
      `${lastName}, ${firstName} — DNI ${dni}`,
    professionalLabel: "Profesional",
    professionalPlaceholder: "Seleccionar",
  },
  preview: {
    cardTitle: "Vista previa",
    emptyHint: "Elegí paciente, profesional y completá los campos para generar la planilla.",
    preAriaLabel: "Vista previa de la planilla PAMI generada",
    actionsAriaLabel: "Acciones de la planilla",
    copy: "Copiar",
    print: "Imprimir / PDF",
    save: "Guardar en historial",
    saveAriaLoading: "Guardando planilla en historial",
    saveAriaIdle: "Guardar planilla en historial",
  },
  emptyState: {
    noResultsTitle: "Sin resultados",
    noPatientsTitle: "No hay pacientes PAMI registrados",
    noResultsDescription: (query: string) =>
      `No encontramos pacientes PAMI que coincidan con “${query}”. Verificá el nombre, apellido o DNI e intentá de nuevo.`,
    noPatientsDescription:
      "Para generar planillas necesitás pacientes con cobertura PAMI en el consultorio. Creá el primero manualmente, importá un listado desde Excel o actualizá si acabas de cargarlos en otra pantalla.",
    createPatient: "Crear paciente",
    createPatientAria: "Crear paciente PAMI",
    importPatients: "Importar pacientes",
    importPatientsAria: "Importar pacientes desde Excel",
    refresh: "Actualizar",
    refreshAriaLoading: "Actualizando listado de pacientes",
    refreshAriaIdle: "Actualizar listado de pacientes",
  },
  skeleton: {
    resultsAriaLabel: "Cargando resultados de pacientes PAMI",
    resultsSrOnly: "Cargando resultados de pacientes PAMI…",
    paginationAriaLabel: "Cargando paginación de pacientes PAMI",
    paginationSrOnly: "Cargando paginación…",
    pageAriaLabel: "Cargando planillas PAMI",
    pageSrOnly: "Cargando planillas PAMI…",
    transitionAriaLabel: "Actualizando resultados",
    transitionSrOnly: "Actualizando pacientes PAMI…",
  },
  actions: {
    exportIncomplete: "Seleccioná paciente, profesional y completá la planilla.",
    copyFailed:
      "No se pudo copiar al portapapeles. Intentá de nuevo o copiá manualmente desde la vista previa.",
    printFailed: "No se pudo imprimir. Intentá de nuevo o usá «Copiar» desde la vista previa.",
    saveFailed: "No se pudo guardar la planilla. Intentá de nuevo.",
    saveSuccessToast: "Planilla guardada como orden médica",
    printTitleFallback: "Planilla PAMI",
    orderNotesFallback: "Planilla PAMI",
  },
} as const;
