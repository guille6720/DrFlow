import { buildStandardModuleTutorial } from "@/features/tutoriales/definitions/build-module-tutorial";
import type { TutorialAudienceRole, TutorialDefinition } from "@/features/tutoriales/types";

const STAFF: TutorialAudienceRole[] = ["superadmin", "clinic_admin", "doctor", "secretary"];
const CLINICAL: TutorialAudienceRole[] = ["superadmin", "clinic_admin", "doctor"];
const ADMIN: TutorialAudienceRole[] = ["superadmin", "clinic_admin"];
const ADMIN_SECRETARY: TutorialAudienceRole[] = ["superadmin", "clinic_admin", "secretary"];

function mod(
  spec: Parameters<typeof buildStandardModuleTutorial>[0]
): TutorialDefinition {
  return buildStandardModuleTutorial(spec);
}

/** All operational clinic modules except Superadmin and empty Geriatría shells. */
export const CLINIC_MODULE_TUTORIALS: TutorialDefinition[] = [
  mod({
    moduleId: "dashboard",
    startRoute: "/dashboard",
    titleName: "Dashboard",
    description: "Centro de operaciones: agenda del día, cola de espera y accesos rápidos.",
    estimatedMinutes: 4,
    audienceRoles: STAFF,
    actions: [
      {
        id: "ops-nav",
        title: "Barra de operaciones",
        body: "En el panel izquierdo están los accesos a Agenda de hoy y atajos del día.",
        narration:
          "Este es el centro de operaciones de NexClinic. A la izquierda tenés la navegación operativa del día, con accesos a la agenda y otros atajos.",
        placement: "right",
      },
      {
        id: "section-agenda-hoy",
        title: "Agenda de hoy",
        body: "Revisá el bloque Agenda de hoy para ver los turnos del día.",
        narration:
          "El bloque Agenda de hoy resume los turnos del día. Desde acá podés orientar la atención sin salir del dashboard.",
      },
      {
        id: "quick-nuevo-turno",
        title: "Atajo Nuevo turno",
        body: "El acceso rápido Nuevo turno abre el asistente de alta. Esta demo no guarda registros.",
        narration:
          "El atajo Nuevo turno te lleva al asistente de creación. En esta demostración solo lo señalamos: no se guarda ningún turno real.",
        requirePermission: "manageAppointments",
      },
    ],
  }),

  mod({
    moduleId: "pacientes",
    startRoute: "/pacientes",
    titleName: "Pacientes",
    description: "Buscá pacientes, abrí fichas y creá altas administrativas.",
    estimatedMinutes: 4,
    audienceRoles: STAFF,
    actions: [
      {
        id: "buscar",
        title: "Buscar pacientes",
        body: "Usá el buscador para filtrar por nombre o documento.",
        narration:
          "En Pacientes, el buscador te permite encontrar a una persona por nombre o documento sin recorrer toda la lista.",
        requirePermission: "managePatients",
      },
      {
        id: "nuevo",
        title: "Nuevo paciente",
        body: "El botón Nuevo paciente inicia el alta. Esta demo no crea pacientes reales.",
        narration:
          "El botón Nuevo paciente abre el formulario de alta. En la demostración no se crea ningún registro real.",
        requirePermission: "managePatients",
      },
      {
        id: "contador-activos",
        title: "Contador de activos",
        body: "El contador muestra cuántos pacientes activos hay en la clínica.",
        narration:
          "El contador de pacientes activos te da una lectura rápida del volumen de la clínica.",
      },
    ],
  }),

  mod({
    moduleId: "consultas",
    startRoute: "/consultas",
    titleName: "Consultas",
    description: "Flujo del médico: consultas del día, evolucionar y finalizar.",
    estimatedMinutes: 5,
    audienceRoles: CLINICAL,
    actions: [
      {
        id: "card-dia",
        title: "Consultas del día",
        body: "El listado Consultas del día concentra las atenciones pendientes y en curso.",
        narration:
          "En Consultas ves el listado del día. Desde acá el médico retoma cada atención sin perder el contexto clínico.",
        requirePermission: "editClinicalRecords",
      },
      {
        id: "link-sala-espera",
        title: "Ir a sala de espera",
        body: "El acceso Sala de espera conecta con la cola operativa.",
        narration:
          "El acceso a Sala de espera te lleva a la cola de pacientes que aguardan ser llamados.",
      },
      {
        id: "finalizar",
        title: "Finalizar consulta",
        body: "Cuando corresponde, Finalizar consulta cierra la atención. La demo no lo ejecuta.",
        narration:
          "El control Finalizar consulta cierra la atención en curso. En esta demostración solo lo señalamos.",
        requirePermission: "editClinicalRecords",
      },
    ],
  }),

  mod({
    moduleId: "equipo",
    startRoute: "/ingreso-profesionales",
    titleName: "Equipo",
    description: "Alta y edición de profesionales, pestañas de perfil y horarios.",
    estimatedMinutes: 5,
    audienceRoles: ADMIN,
    actions: [
      {
        id: "nuevo-profesional",
        title: "Nuevo profesional",
        body: "Inicia el ingreso de un integrante del equipo. La demo no guarda datos.",
        narration:
          "Nuevo profesional abre el flujo de ingreso del equipo médico. En la demo no se guarda ningún profesional.",
        requirePermission: "manageStaff",
      },
      {
        id: "tab-perfil",
        title: "Pestaña Perfil",
        body: "En Perfil cargás los datos personales y profesionales.",
        narration: "La pestaña Perfil concentra los datos del profesional seleccionado.",
        requirePermission: "manageStaff",
      },
      {
        id: "tab-horarios",
        title: "Pestaña Horarios",
        body: "En Horarios definís la disponibilidad para la agenda.",
        narration:
          "La pestaña Horarios define cuándo el profesional puede recibir turnos en la agenda.",
        requirePermission: "manageStaff",
      },
    ],
  }),

  mod({
    moduleId: "plantillas",
    startRoute: "/plantillas",
    titleName: "Plantillas clínicas",
    description: "Creá y reutilizá plantillas para evoluciones y formularios.",
    estimatedMinutes: 4,
    audienceRoles: CLINICAL,
    actions: [
      {
        id: "nueva",
        title: "Nueva plantilla",
        body: "Creá una plantilla clínica reutilizable. La demo no guarda cambios.",
        narration:
          "Nueva plantilla abre el editor para armar textos y estructuras que después aplicás en la historia clínica.",
        requirePermission: "editClinicalRecords",
      },
      {
        id: "lista",
        title: "Listado de plantillas",
        body: "El listado muestra las plantillas guardadas de la clínica.",
        narration: "Acá ves las plantillas ya guardadas para reutilizarlas en la consulta.",
        requirePermission: "editClinicalRecords",
      },
      {
        id: "guardar",
        title: "Guardar plantilla",
        body: "Guardá los cambios de la plantilla. La demo no escribe en la base.",
        narration:
          "Cuando terminás de editar, Guardar deja la plantilla lista para usarla. En la demo no se guarda nada real.",
        requirePermission: "editClinicalRecords",
      },
    ],
  }),

  mod({
    moduleId: "plantillas-recetas",
    startRoute: "/plantillas-recetas",
    titleName: "Plantillas de recetas",
    description: "Plantillas para recetas frecuentes.",
    estimatedMinutes: 3,
    audienceRoles: CLINICAL,
    actions: [
      {
        id: "nueva",
        title: "Nueva plantilla de receta",
        body: "Creá una plantilla de receta. La demo no guarda.",
        narration:
          "Nueva plantilla te permite armar esquemas de receta que después reutilizás al prescribir.",
        requirePermission: "issuePrescriptions",
      },
      {
        id: "lista",
        title: "Plantillas guardadas",
        body: "Revisá las plantillas de receta ya cargadas.",
        narration: "El listado muestra las plantillas de receta disponibles en tu clínica.",
        requirePermission: "issuePrescriptions",
      },
    ],
  }),

  mod({
    moduleId: "ordenes",
    startRoute: "/ordenes-medicas",
    titleName: "Órdenes médicas",
    description: "Buscá, filtrá y creá órdenes médicas.",
    estimatedMinutes: 4,
    audienceRoles: CLINICAL,
    actions: [
      {
        id: "buscar",
        title: "Buscar órdenes",
        body: "El buscador filtra órdenes por número o texto.",
        narration: "Con el buscador encontrás órdenes médicas ya emitidas o en borrador.",
        requirePermission: "viewMedicalOrders",
      },
      {
        id: "nueva",
        title: "Nueva orden médica",
        body: "Inicia una orden. La demo no crea documentos clínicos.",
        narration:
          "Nueva orden médica abre el flujo de emisión. En esta demostración no se genera ninguna orden real.",
        requirePermission: "viewMedicalOrders",
      },
      {
        id: "limpiar-filtros",
        title: "Limpiar filtros",
        body: "Restablecé los filtros del listado.",
        narration: "Limpiar filtros vuelve el listado al estado completo sin criterios aplicados.",
        requirePermission: "viewMedicalOrders",
      },
    ],
  }),

  mod({
    moduleId: "firmas",
    startRoute: "/firmas",
    titleName: "Firmas",
    description: "Texto e imagen de firma de profesionales.",
    estimatedMinutes: 3,
    audienceRoles: CLINICAL,
    actions: [
      {
        id: "select-profesional",
        title: "Elegir profesional",
        body: "Seleccioná un profesional del listado lateral.",
        narration: "Primero elegís el profesional cuya firma vas a configurar.",
        requirePermission: "editClinicalRecords",
      },
      {
        id: "guardar-texto",
        title: "Guardar texto de firma",
        body: "Guardá el texto de firma. La demo no persiste cambios.",
        narration:
          "Guardar texto deja listo el bloque de firma para documentos. En la demo no se guarda nada real.",
        requirePermission: "editClinicalRecords",
      },
      {
        id: "subir-imagen",
        title: "Subir imagen de firma",
        body: "Podés asociar una imagen de firma. La demo no sube archivos.",
        narration:
          "Subir imagen permite adjuntar una firma gráfica. Esta demostración no carga ningún archivo.",
        requirePermission: "editClinicalRecords",
      },
    ],
  }),

  mod({
    moduleId: "turnos-nuevo",
    startRoute: "/turnos/nuevo",
    titleName: "Nuevo turno",
    description: "Asistente de alta: profesional, paciente, horarios y confirmación.",
    estimatedMinutes: 5,
    audienceRoles: STAFF,
    actions: [
      {
        id: "profesional",
        title: "Paso Profesional",
        body: "Elegí el profesional del turno.",
        narration: "El primer paso del asistente es elegir el profesional que atenderá el turno.",
        requirePermission: "manageAppointments",
      },
      {
        id: "paciente",
        title: "Paso Paciente",
        body: "Seleccioná o buscá el paciente.",
        narration: "Después asociás el paciente que va a asistir a la consulta.",
        requirePermission: "manageAppointments",
      },
      {
        id: "horarios",
        title: "Paso Horarios",
        body: "Elegí fecha y hora disponible.",
        narration: "En Horarios ves la grilla de disponibilidad para confirmar el momento del turno.",
        requirePermission: "manageAppointments",
      },
      {
        id: "confirmar",
        title: "Confirmar turno",
        body: "Confirmar guarda el turno. Esta demo no lo ejecuta.",
        narration:
          "Confirmar turno guarda la cita. En esta demostración solo señalamos el botón: no se crea ningún turno real.",
        requirePermission: "manageAppointments",
      },
    ],
  }),

  mod({
    moduleId: "turnos-reportes",
    startRoute: "/turnos/reportes",
    titleName: "Reportes de turnos",
    description: "Resúmenes por período y acceso rápido a la agenda.",
    estimatedMinutes: 3,
    audienceRoles: ADMIN_SECRETARY,
    actions: [
      {
        id: "periodo",
        title: "Período del reporte",
        body: "Cambiá entre Semana, Mes o Año.",
        narration: "Las pestañas de período cambian el alcance del resumen de turnos.",
        requirePermission: "viewReports",
      },
      {
        id: "resumen",
        title: "Resumen",
        body: "El bloque Resumen concentra los indicadores del período.",
        narration: "El resumen muestra los indicadores clave de turnos para el período elegido.",
        requirePermission: "viewReports",
      },
      {
        id: "link-agenda",
        title: "Ir a la agenda",
        body: "Volvé a la agenda operativa desde el reporte.",
        narration: "Desde acá podés volver a la agenda para actuar sobre los turnos del día.",
      },
    ],
  }),

  mod({
    moduleId: "agenda-config",
    startRoute: "/turnos/configuracion",
    titleName: "Configuración de agenda",
    description: "Horarios semanales y reglas de la agenda.",
    estimatedMinutes: 4,
    audienceRoles: ADMIN,
    actions: [
      {
        id: "horarios",
        title: "Horarios semanales",
        body: "Revisá la grilla de horarios de atención.",
        narration:
          "En Configuración de agenda definís los horarios semanales que alimentan la disponibilidad.",
        requirePermission: "manageSettings",
      },
      {
        id: "agregar-horario",
        title: "Agregar horario",
        body: "Sumá un bloque horario. La demo no guarda.",
        narration:
          "Agregar horario crea un nuevo bloque de disponibilidad. En la demo no se guarda ningún cambio.",
        requirePermission: "manageSettings",
      },
      {
        id: "guardar",
        title: "Guardar cambios",
        body: "Persistí la regla editada. La demo no escribe.",
        narration: "Guardar confirma los cambios de configuración. Esta demostración no los aplica.",
        requirePermission: "manageSettings",
      },
    ],
  }),

  mod({
    moduleId: "atenciones",
    startRoute: "/atenciones",
    titleName: "Atenciones",
    description: "Registro de atenciones, períodos y exportación.",
    estimatedMinutes: 3,
    audienceRoles: STAFF,
    actions: [
      {
        id: "periodo-hoy",
        title: "Período Hoy",
        body: "Filtrá el registro al día de hoy.",
        narration: "Con el filtro Hoy ves solo las atenciones del día corriente.",
      },
      {
        id: "detalle",
        title: "Detalle de atenciones",
        body: "El detalle lista cada atención del período.",
        narration: "El detalle muestra cada atención registrada para revisar o exportar.",
      },
      {
        id: "exportar-csv",
        title: "Exportar CSV",
        body: "Exportá el listado. La demo no descarga archivos clínicos reales como parte del guion.",
        narration:
          "Exportar CSV genera un archivo del período. En la demostración solo indicamos dónde está el control.",
      },
    ],
  }),

  mod({
    moduleId: "telemedicina",
    startRoute: "/telemedicina",
    titleName: "Telemedicina",
    description: "Turnos virtuales, unirse a sesión y link del paciente.",
    estimatedMinutes: 4,
    audienceRoles: CLINICAL,
    actions: [
      {
        id: "turnos-virtuales",
        title: "Turnos virtuales",
        body: "Listado de próximos turnos virtuales.",
        narration: "Acá ves los turnos virtuales próximos de la clínica.",
        requirePermission: "viewClinicalRecords",
      },
      {
        id: "unirse",
        title: "Unirse a la sesión",
        body: "Ingresá a la videollamada. La demo no inicia una sesión real.",
        narration:
          "Unirse abre la sesión de telemedicina. En esta demostración no iniciamos ninguna llamada.",
        requirePermission: "viewClinicalRecords",
      },
      {
        id: "link-paciente",
        title: "Link del paciente",
        body: "Copiá o compartí el acceso del paciente.",
        narration: "El link del paciente le permite ingresar a la consulta virtual.",
        requirePermission: "viewClinicalRecords",
      },
    ],
  }),

  mod({
    moduleId: "sala-espera",
    startRoute: "/sala-espera",
    titleName: "Sala de espera",
    description: "Columnas de estado y pasos a Consultas.",
    estimatedMinutes: 4,
    audienceRoles: STAFF,
    actions: [
      {
        id: "columna-esperando",
        title: "Columna Esperando",
        body: "Pacientes en espera de ser llamados.",
        narration: "La columna Esperando agrupa a quienes todavía no fueron llamados.",
        requirePermission: "manageWaitingRoom",
      },
      {
        id: "confirmar-consultas",
        title: "Confirmar hacia Consultas",
        body: "Pasa el paciente a la atención. La demo no mueve registros.",
        narration:
          "Confirmar hacia Consultas mueve al paciente al flujo clínico. En la demo no cambiamos estados reales.",
        requirePermission: "manageWaitingRoom",
      },
      {
        id: "link-agenda",
        title: "Ir a la agenda",
        body: "Volvé a la agenda desde la sala de espera.",
        narration: "Desde Sala de espera también podés volver a la agenda operativa.",
      },
    ],
  }),

  mod({
    moduleId: "datos",
    startRoute: "/datos",
    titleName: "Importar y exportar",
    description: "Hub de importación y exportación de datos.",
    estimatedMinutes: 4,
    audienceRoles: ADMIN_SECRETARY,
    actions: [
      {
        id: "importar-pacientes",
        title: "Importar pacientes",
        body: "Inicia la importación de pacientes. La demo no carga archivos.",
        narration:
          "Importar pacientes abre el flujo para cargar un archivo. En la demostración no se importa nada.",
      },
      {
        id: "exportar-pacientes",
        title: "Exportar pacientes",
        body: "Exportá el padrón según tus permisos. La demo no descarga datos.",
        narration:
          "Exportar pacientes genera un archivo del padrón. Solo lo señalamos; no descargamos información.",
      },
      {
        id: "volver-configuracion",
        title: "Volver a Configuración",
        body: "Regresá a la configuración del consultorio.",
        narration: "Desde acá podés volver a Configuración cuando termines el trabajo de datos.",
      },
    ],
  }),

  mod({
    moduleId: "caja",
    startRoute: "/caja",
    titleName: "Caja",
    description: "Cobros del día, movimientos y cierre.",
    estimatedMinutes: 4,
    audienceRoles: ADMIN_SECRETARY,
    actions: [
      {
        id: "registrar-cobro",
        title: "Registrar cobro",
        body: "Formulario de cobro. La demo no registra pagos.",
        narration:
          "En Registrar cobro cargás el importe y el medio de pago. Esta demostración no registra ningún cobro real.",
        requirePermission: "manageCashRegister",
      },
      {
        id: "cobrar",
        title: "Cobrar",
        body: "Confirma el cobro. La demo no lo ejecuta.",
        narration: "El botón Cobrar confirma la operación. En la demo no se cobra nada.",
        requirePermission: "manageCashRegister",
      },
      {
        id: "movimientos-hoy",
        title: "Movimientos de hoy",
        body: "Listado de movimientos del día.",
        narration: "Movimientos de hoy muestra lo cobrado y anulado en la jornada.",
        requirePermission: "manageCashRegister",
      },
      {
        id: "link-cierre",
        title: "Cierre diario",
        body: "Acceso al cierre de caja del día.",
        narration: "Desde Cierre diario cerrás la caja del período.",
        requirePermission: "manageCashRegister",
      },
    ],
  }),

  mod({
    moduleId: "liquidacion",
    startRoute: "/facturacion/liquidacion",
    titleName: "Liquidación OS",
    description: "Lotes y pendientes de liquidación a obras sociales.",
    estimatedMinutes: 4,
    audienceRoles: ADMIN_SECRETARY,
    actions: [
      {
        id: "nuevo-lote",
        title: "Nuevo lote",
        body: "Creá un lote de liquidación. La demo no lo crea.",
        narration:
          "Nuevo lote inicia una liquidación a obra social. En la demo no se genera ningún lote real.",
        requirePermission: "manageCashRegister",
      },
      {
        id: "pendientes",
        title: "Pendientes de liquidar",
        body: "Atenciones u órdenes aún no liquidadas.",
        narration: "Pendientes de liquidar muestra lo que todavía no entró en un lote.",
        requirePermission: "manageCashRegister",
      },
      {
        id: "tarifas-os",
        title: "Tarifas OS",
        body: "Acceso a la tabla de tarifas.",
        narration: "Desde Tarifas OS consultás o ajustás los valores por obra social.",
        requirePermission: "manageCashRegister",
      },
    ],
  }),

  mod({
    moduleId: "geriatria",
    startRoute: "/geriatria",
    titleName: "Geriatría",
    description: "Panel general: residentes activos, camas y capacidad.",
    estimatedMinutes: 3,
    audienceRoles: STAFF,
    actions: [
      {
        id: "kpi-residentes",
        title: "Residentes activos",
        body: "KPI de residentes activos del hogar.",
        narration: "El indicador de residentes activos resume la ocupación actual.",
        requirePermission: "viewGeriatrics",
      },
      {
        id: "kpi-camas",
        title: "Camas ocupadas",
        body: "KPI de camas en uso.",
        narration: "Camas ocupadas te muestra la capacidad utilizada del servicio.",
        requirePermission: "viewGeriatrics",
      },
      {
        id: "capacidad",
        title: "Capacidad",
        body: "Tarjeta de capacidad del servicio de geriatría.",
        narration: "La tarjeta Capacidad resume plazas y ocupación del módulo Geriatría.",
        requirePermission: "viewGeriatrics",
      },
    ],
  }),

  mod({
    moduleId: "geriatria-residentes",
    startRoute: "/geriatria/residentes",
    titleName: "Residentes",
    description: "Listado de residentes y acceso a fichas.",
    estimatedMinutes: 3,
    audienceRoles: STAFF,
    actions: [
      {
        id: "nuevo",
        title: "Nuevo residente",
        body: "Alta de residente. La demo no crea registros.",
        narration:
          "Nuevo residente inicia el alta. En esta demostración no se crea ningún residente real.",
        requirePermission: "manageGeriatrics",
      },
      {
        id: "ver-pacientes",
        title: "Ver pacientes",
        body: "Acceso al padrón general de pacientes.",
        narration: "Ver pacientes te lleva al padrón general cuando necesitás cruzar información.",
      },
      {
        id: "listado",
        title: "Listado de residentes",
        body: "Tabla o listado de residentes del hogar.",
        narration: "El listado concentra a los residentes para abrir resumen o ficha.",
        requirePermission: "viewGeriatrics",
      },
    ],
  }),

  mod({
    moduleId: "ayuda",
    startRoute: "/ayuda",
    titleName: "Ayuda y manual",
    description: "Manual de uso, novedades y descarga PDF.",
    estimatedMinutes: 3,
    audienceRoles: STAFF,
    actions: [
      {
        id: "indice-secciones",
        title: "Índice del manual",
        body: "Navegá las secciones del manual.",
        narration: "El índice te lleva a cada sección del manual de NexClinic.",
      },
      {
        id: "novedades",
        title: "Novedades",
        body: "Qué hay de nuevo en la versión actual.",
        narration: "En Novedades ves los cambios recientes de la aplicación.",
      },
      {
        id: "descargar-pdf",
        title: "Descargar PDF",
        body: "Descargá el manual en PDF.",
        narration: "Descargar manual PDF genera el documento para leerlo fuera de la app.",
      },
    ],
  }),
];
