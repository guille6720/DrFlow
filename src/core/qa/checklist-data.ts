export interface QaChecklistItem {
  id: string;
  label: string;
  href?: string;
}

export interface QaChecklistSection {
  id: string;
  title: string;
  items: QaChecklistItem[];
}

export const QA_CHECKLIST: QaChecklistSection[] = [
  {
    id: "auth",
    title: "Autenticación y roles",
    items: [
      { id: "auth-login", label: "Login con credenciales válidas redirige a /dashboard", href: "/login" },
      { id: "auth-error", label: "Login inválido muestra error claro en español", href: "/login" },
      { id: "auth-google", label: "Continuar con Google completa sesión y /auth/complete", href: "/login" },
      { id: "auth-reset", label: "Restablecer contraseña envía link a dominio público (nunca localhost)", href: "/login" },
      { id: "auth-confirm", label: "/auth/confirm abre formulario de nueva contraseña o error claro", href: "/login/restablecer" },
      { id: "auth-register", label: "Registro de clínica (2 pasos + Google) crea cuenta y clínica", href: "/register" },
      { id: "auth-clinic-switch", label: "Selector de clínica cambia contexto activo", href: "/dashboard" },
      { id: "auth-protected", label: "Rutas protegidas redirigen sin sesión" },
      { id: "auth-secretary-config", label: "Secretaría no accede a /configuracion" },
      { id: "auth-invite", label: "Invitar usuario desde Configuración → Equipo", href: "/configuracion" },
      { id: "auth-qa-hidden", label: "Checklist QA no aparece en sidebar para clinic_admin/doctor" },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    items: [
      { id: "dash-kpis", label: "KPIs cargan sin error (vacío o con datos)", href: "/dashboard" },
      { id: "dash-live", label: "Atender ahora abre consulta en 1–2 taps", href: "/dashboard" },
      { id: "dash-turnos", label: "Próximos turnos listan correctamente", href: "/dashboard" },
      { id: "dash-links", label: "Accesos rápidos navegan bien", href: "/dashboard" },
      { id: "dash-mobile", label: "Responsive en mobile (320px+)" },
    ],
  },
  {
    id: "agenda",
    title: "Agenda",
    items: [
      { id: "agenda-create", label: "Crear turno con datos válidos", href: "/turnos/nuevo" },
      { id: "agenda-overlap", label: "Error al superponer turnos del mismo profesional", href: "/agenda" },
      { id: "agenda-status", label: "Confirmar / ausente cambia estado", href: "/agenda?view=day" },
      { id: "agenda-start", label: "Empezar consulta abre historia con paciente precargado", href: "/agenda?view=day" },
      { id: "agenda-web-badge", label: "Turnos web muestran badge 🌐", href: "/agenda?view=day" },
      { id: "agenda-filters", label: "Filtros por médico y especialidad", href: "/agenda" },
      { id: "agenda-week", label: "Vista semanal muestra turnos", href: "/agenda" },
    ],
  },
  {
    id: "patients",
    title: "Pacientes",
    items: [
      { id: "pat-crud", label: "Crear, listar y ver ficha de paciente", href: "/pacientes" },
      { id: "pat-search", label: "Búsqueda por nombre y DNI", href: "/pacientes" },
      { id: "pat-validation", label: "Validación de campos requeridos", href: "/pacientes/nuevo" },
      { id: "pat-history", label: "Historial en ficha del paciente", href: "/pacientes" },
      { id: "pat-coverages", label: "Coberturas del consultorio en Configuración + select paciente", href: "/configuracion" },
      { id: "pat-renew", label: "Renovación rápida de medicación desde ficha", href: "/pacientes" },
      { id: "pat-banner", label: "Banner clínico (alergias/meds/cobertura) al empezar consulta", href: "/historias/nueva" },
    ],
  },
  {
    id: "clinical",
    title: "Historia clínica",
    items: [
      { id: "hc-create", label: "Crear consulta con plantilla", href: "/historias/nueva" },
      { id: "hc-timer", label: "Timer visible al empezar desde agenda", href: "/agenda?view=day" },
      { id: "hc-finish", label: "Finalizar consulta vuelve a agenda", href: "/historias" },
      { id: "hc-audit", label: "Auditoría registra creación", href: "/historias" },
      { id: "hc-pdf", label: "Export PDF descarga archivo", href: "/historias" },
      { id: "hc-edit-perm", label: "Solo médico/admin edita registros" },
    ],
  },
  {
    id: "prescriptions",
    title: "Recetas y órdenes",
    items: [
      { id: "rx-wizard", label: "Wizard 3 pasos: cobertura → meds → revisar/emitir", href: "/pacientes" },
      { id: "rx-pami", label: "Receta PAMI exige beneficio + diagnóstico", href: "/pacientes" },
      { id: "rx-particular", label: "Receta particular emite sin afiliado", href: "/pacientes" },
      { id: "rx-template", label: "Plantilla prefill + confirmación antes de emitir", href: "/plantillas-recetas" },
      { id: "rx-reuse", label: "Reutilizar meds desde historial abre wizard", href: "/pacientes" },
      { id: "rx-coverage-pdf", label: "PDF muestra cobertura/afiliado/plan", href: "/pacientes" },
      { id: "rx-qr-local", label: "QR local en PDF (sin servicio externo)", href: "/pacientes" },
      { id: "rx-whatsapp-confirm", label: "WhatsApp pide confirmación antes de enviar", href: "/pacientes" },
      { id: "rx-idempotency", label: "Doble clic emitir no duplica receta", href: "/pacientes" },
      { id: "rx-pami-config", label: "Config reglas por cobertura en /configuracion?seccion=coberturas", href: "/configuracion?seccion=coberturas" },
      { id: "rx-dispensed", label: "Marcar receta emitida como dispensada", href: "/pacientes" },
      { id: "rx-med-search", label: "PAMI usa vademécum; OS/prepaga usa guía farmacológica", href: "/pacientes" },
      { id: "rx-vademecum-code", label: "Línea PAMI guarda y muestra cód. vademécum (alfabeta)", href: "/pacientes" },
      { id: "rx-coverage-lock", label: "Cobertura del legajo bloqueada en wizard (no bypass PARTICULAR)", href: "/pacientes" },
      { id: "rx-order", label: "Crear orden médica / estudios", href: "/pacientes" },
    ],
  },
  {
    id: "pharma",
    title: "Farmacología",
    items: [
      { id: "ph-pathology", label: "Búsqueda por patología / CIE-10", href: "/herramientas/farmacologia" },
      { id: "ph-symptoms", label: "Búsqueda por síntomas sugiere patologías", href: "/herramientas/farmacologia?mode=symptoms" },
    ],
  },
  {
    id: "portal",
    title: "Portal paciente y coberturas",
    items: [
      { id: "portal-pami", label: "Portal dice Receta PAMI solo si la clínica acepta PAMI", href: "/portal" },
      { id: "portal-turns", label: "Mis turnos carga turnos web por DNI (servidor)", href: "/portal" },
      { id: "atenciones-cov", label: "Atenciones resume por cobertura + CSV", href: "/atenciones" },
    ],
  },
  {
    id: "booking",
    title: "Reserva pública",
    items: [
      { id: "book-link", label: "Link público activo en Configuración", href: "/configuracion" },
      { id: "book-slots", label: "Paciente ve turnos disponibles (requiere horarios cargados)", href: "/configuracion" },
      { id: "book-submit", label: "Solicitud crea turno pending en agenda" },
      { id: "book-empty", label: "Empty state sin filtrar migraciones SQL", href: "/solicitar-turno/centro-medico-norte-turnos" },
    ],
  },
  {
    id: "ops",
    title: "Labs / experimentales (ocultos en nav core)",
    items: [
      { id: "ops-reminders", label: "Abrir WhatsApp vs email simulado — copy honesto", href: "/recordatorios" },
      { id: "ops-tele", label: "Telemedicina genera link Jitsi (lab)", href: "/telemedicina" },
      { id: "ops-payments", label: "Pago mock registra transacción (lab)", href: "/pagos" },
      { id: "ops-reports", label: "Reportes y export CSV", href: "/reportes" },
    ],
  },
  {
    id: "security",
    title: "Seguridad y UX",
    items: [
      { id: "sec-rls", label: "Usuario clínica A no ve datos clínica B" },
      { id: "sec-xss", label: "Inputs con <script> sanitizados" },
      { id: "sec-empty", label: "Estados vacíos con icono y acción" },
      { id: "sec-errors", label: "Mensajes de error claros en español (sin Dashboard Supabase)" },
      { id: "tests-auto", label: "npm test pasa (20+ tests)" },
    ],
  },
];

export function qaStats(checked: Record<string, boolean>) {
  const items = QA_CHECKLIST.flatMap((s) => s.items);
  const done = items.filter((i) => checked[i.id]).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}
