/** Contenido del Manual del médico — fuente única para /ayuda y PDF. */

export type ManualStep = {
  title: string;
  body: string;
};

export type ManualSection = {
  id: string;
  title: string;
  summary: string;
  /** Clave de ilustración SVG en la UI */
  illustration:
    | "dashboard"
    | "agenda"
    | "pacientes"
    | "consulta"
    | "recetas"
    | "farmacologia"
    | "portal"
    | "config";
  steps: ManualStep[];
  tips?: string[];
};

export const MANUAL_TITLE = "Manual de uso DrFlow — Consultorio";
export const MANUAL_SUBTITLE =
  "Guía rápida para médicos y equipo. Se actualiza con cada nueva versión de la app.";

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "inicio",
    title: "1. Dashboard y Atender ahora",
    summary:
      "Al entrar ves el consultorio en vivo: próximo paciente, progreso del día y accesos al flujo clínico.",
    illustration: "dashboard",
    steps: [
      {
        title: "Entrá con tu cuenta",
        body: "Usá email/contraseña o Continuar con Google. Si olvidaste la clave, pedí el link de restablecer (llega a tu correo).",
      },
      {
        title: "Miriá el panel «Consultorio en vivo»",
        body: "Muestra el próximo turno y cuántos ya atendiste hoy.",
      },
      {
        title: "Tocá «Atender ahora»",
        body: "Abre la consulta del paciente pendiente (confirma el turno si hace falta) y arranca el timer.",
      },
    ],
    tips: [
      "Si no hay turnos, usá «Nuevo turno» o cargá datos demo desde Configuración.",
    ],
  },
  {
    id: "agenda",
    title: "2. Agenda del día",
    summary: "Gestioná turnos, confirmá, marcá ausentes y empezá consultas.",
    illustration: "agenda",
    steps: [
      {
        title: "Abrí Agenda → vista día",
        body: "Ves la cola del día con estado (pendiente, confirmado, atendido).",
      },
      {
        title: "Creá un turno",
        body: "Elegí paciente, profesional, horario y modalidad (presencial / virtual).",
      },
      {
        title: "Empezar consulta",
        body: "Desde la fila del turno abrís la historia precargada con el paciente.",
      },
    ],
    tips: [
      "Los turnos pedidos por la web del paciente aparecen con badge «Web».",
      "Bloqueos y horarios se cargan en Configuración → Disponibilidad.",
    ],
  },
  {
    id: "pacientes",
    title: "3. Pacientes",
    summary: "Ficha clínica, coberturas, app del paciente y renovación de medicación.",
    illustration: "pacientes",
    steps: [
      {
        title: "Alta de paciente",
        body: "Nombre, DNI, cobertura (lista de tu consultorio) y N° afiliado o beneficio PAMI.",
      },
      {
        title: "Banner clínico",
        body: "En la ficha ves alergias, medicación habitual, cobertura y si es adulto mayor.",
      },
      {
        title: "Renovar medicación",
        body: "Desde la ficha, «Renovar medicación» prefilla la última receta o la medicación habitual.",
      },
      {
        title: "App para el paciente",
        body: "Compartí el link/PWA por WhatsApp para que pida turnos y recetas.",
      },
    ],
  },
  {
    id: "consulta",
    title: "4. Historia clínica",
    summary: "Flujo guiado: motivo → evolución → diagnóstico → indicaciones → receta.",
    illustration: "consulta",
    steps: [
      {
        title: "Antes de escribir",
        body: "Revisá el banner con alergias y medicación del paciente.",
      },
      {
        title: "Completá la consulta",
        body: "Podés usar plantillas por especialidad. El timer corre si viniste desde un turno.",
      },
      {
        title: "Guardá y seguí a receta",
        body: "Al guardar vas a la historia y podés emitir orden o receta.",
      },
    ],
  },
  {
    id: "recetas",
    title: "5. Recetas electrónicas",
    summary: "Receta local Ley 25.649. No es homologación REFEPS hasta que la clínica complete ese trámite.",
    illustration: "recetas",
    steps: [
      {
        title: "Cargá medicación",
        body: "A mano o desde la guía farmacológica (patología / síntomas).",
      },
      {
        title: "Aceptá el aviso legal",
        body: "Debés marcar el checkbox de receta local / borrador (no REFEPS).",
      },
      {
        title: "Emití y compartí",
        body: "Guardá borrador o emití. Descargá PDF y enviá por WhatsApp al paciente.",
      },
    ],
    tips: [
      "Sin el checkbox aceptado no se puede guardar ni emitir.",
    ],
  },
  {
    id: "farmacologia",
    title: "6. Guía farmacológica",
    summary: "Buscá por CIE-10/patología o por lo que cuenta el paciente.",
    illustration: "farmacologia",
    steps: [
      {
        title: "Modo patología",
        body: "Buscá el diagnóstico y agregá esquemas sugeridos a la receta.",
      },
      {
        title: "Modo síntomas",
        body: "Escribí síntomas → sugiere patologías y tratamientos.",
      },
    ],
  },
  {
    id: "portal",
    title: "7. Portal del paciente y turnos online",
    summary: "El paciente pide turno y receta desde su PWA verde.",
    illustration: "portal",
    steps: [
      {
        title: "Activá el link público",
        body: "En Configuración revisá el slug y el teléfono del consultorio.",
      },
      {
        title: "Cargá disponibilidad",
        body: "Sin horarios semanales no hay slots en solicitar-turno.",
      },
      {
        title: "Compartí la app",
        body: "Desde la ficha del paciente: instalar / WhatsApp.",
      },
    ],
    tips: [
      "Si la clínica no acepta PAMI, el portal dice «Solicitar receta» (no Receta PAMI).",
      "«Mis turnos» del paciente se guarda en ese teléfono/navegador.",
    ],
  },
  {
    id: "config",
    title: "8. Configuración del consultorio",
    summary: "Equipo, coberturas, horarios, perfil PAMI y datos demo.",
    illustration: "config",
    steps: [
      {
        title: "Coberturas aceptadas",
        body: "Marcá PAMI, OSDE, etc. Eso alimenta el alta de pacientes y el portal.",
      },
      {
        title: "Disponibilidad",
        body: "Agregá días/horarios por profesional (incluye domingo si atienden).",
      },
      {
        title: "Datos demo",
        body: "Útil para capacitar al equipo sin cargar pacientes reales.",
      },
    ],
  },
  {
    id: "atenciones",
    title: "9. Registro de atenciones",
    summary: "Totales del día/semana/mes por modalidad y cobertura, con export CSV.",
    illustration: "dashboard",
    steps: [
      {
        title: "Abrí Atenciones",
        body: "Elegí período Hoy / Semana / Mes.",
      },
      {
        title: "Revisá coberturas",
        body: "El resumen agrupa por obra social (PAMI, OSDE, Particular…).",
      },
      {
        title: "Exportá CSV",
        body: "Para liquidaciones o planillas internas.",
      },
    ],
  },
];
