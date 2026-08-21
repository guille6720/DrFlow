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
      { id: "ops-reminders", label: "WhatsApp API vs wa.me manual — copy honesto", href: "/recordatorios" },
      { id: "ops-tele", label: "Telemedicina genera link Jitsi (lab)", href: "/telemedicina" },
      { id: "ops-payments", label: "Pago mock registra transacción (lab)", href: "/pagos" },
      { id: "ops-reports", label: "Reportes y export CSV", href: "/reportes" },
      { id: "ops-comercial", label: "Superadmin asigna plan comercial (legacy/trial/basic/pro)", href: "/qa/comercial" },
      { id: "ops-cupos", label: "Plan basic no deja crear más usuarios/profesionales/pacientes que el cupo", href: "/qa/comercial" },
      { id: "ops-uso", label: "Configuración muestra cupos y superadmin puede past_due/cancelled/expired", href: "/qa/comercial" },
      { id: "ops-storage", label: "Plan basic no deja subir archivos si se agotó storage.max_mb", href: "/configuracion" },
      { id: "ops-addons", label: "Plan basic redirige caja, liquidación OS y farmacología a /planes", href: "/qa/comercial" },
      { id: "ops-portal", label: "Plan basic no muestra reserva pública ni FHIR; receta PDF sigue disponible", href: "/qa/comercial" },
      { id: "ops-suspend", label: "past_due/cancelled/expired pausa extras; dashboard y pacientes siguen", href: "/qa/comercial" },
      { id: "ops-override", label: "Override de superadmin sigue activo aunque el estado sea past_due", href: "/qa/comercial" },
      { id: "ops-restore", label: "Superadmin reactiva extras con estado active; el aviso de vencido desaparece", href: "/qa/comercial" },
      { id: "ops-clear-override", label: "Superadmin lista y quita overrides vigentes", href: "/qa/comercial" },
      { id: "ops-trial-window", label: "Superadmin define trial_ends_at comercial; al vencer pausa extras (core sigue)", href: "/qa/comercial" },
      { id: "ops-trial-expire", label: "Trial comercial vencido pasa a expired y libera el cupo live; flags de IA/WhatsApp/portal no se encienden sin plan", href: "/qa/comercial" },
      { id: "ops-ai-credentials", label: "Plan basic no guarda claves IA ni abre admin-ops / setup PAMI; el clínico core sigue", href: "/qa/comercial" },
      { id: "ops-pami-demo-jobs", label: "Plan basic no publica plantillas PAMI ni encola follow-up IA; datos demo respetan patients.max", href: "/qa/comercial" },
      { id: "ops-intake-ops-links", label: "Ingreso de profesionales respeta professionals.max; dashboard/admin-ops no enlazan caja ni recordatorios sin plan", href: "/qa/comercial" },
      { id: "ops-account-storage-automation", label: "Cuenta oculta extras sin plan; firma respeta storage; follow-up IA pide automation.enabled", href: "/qa/comercial" },
      { id: "ops-automations-max", label: "Plan basic/pro no encola follow-up IA ni WhatsApp job; premium respeta automations.max_active", href: "/qa/comercial" },
      { id: "ops-job-guard", label: "Encolado centralizado + WhatsApp sync respeta whatsapp.enabled y cupo de automatizaciones; seguimiento proactivo pide automation", href: "/qa/comercial" },
      { id: "ops-voice-transcription", label: "Dictado pide voice.enabled y ai.transcription; cuota transcripciones visible; no consume servidor", href: "/configuracion" },
      { id: "ops-planes-datos-export", label: "/planes?modulo= explica el extra; /datos oculta export padrón/masivo sin data_export; importes siguen abiertos", href: "/planes" },
      { id: "ops-plan-modules", label: "Configuración → Tu plan lista extras incluidos/no; dictado plugin pide voice + ai.transcription; FeatureGate ofrece upgrade", href: "/configuracion" },
      { id: "ops-upgrade-notices", label: "AddonUpgradeNotice en API, portal, FHIR, BI, /datos export, plugins y flags bloqueados", href: "/configuracion" },
      { id: "ops-config-locked-hub", label: "Configuración muestra tarjetas bloqueadas (IA/API/PAMI) con upgrade; voz/apariencia no culpan al admin si falta plan; FHIR en HC avisa", href: "/configuracion" },
      { id: "ops-portal-apps-caps", label: "Apps PWA / compartir app paciente respetan portal; invite muestra cupo usuarios; firmas muestran cupo almacenamiento", href: "/configuracion" },
      { id: "ops-commercial-closed", label: "Catálogo comercial cerrado (fases 1–26): ingreso profesionales muestra cupo; dry-run staging 121–128 sin tocar producción", href: "/qa/comercial" },
      { id: "ops-entitlements-dry-run", label: "npm run entitlements:dry-run:verify OK; aplicar 121→128 solo en staging gprmsufvhabntbrytwyi + NOTIFY pgrst", href: "/qa/comercial" },
      { id: "ops-no-prod-gating-yet", label: "Phase 29: pacientes/HC/turnos/órdenes/docs/reportes/PAMI no se cortan por plan; extras comerciales sí (caja, portal, API, etc.)", href: "/qa/comercial" },
      { id: "ops-phase30-tests", label: "Phase 30: vitest acceptance (legacy/trial, overrides, limits, usage, concurrency, tenant isolation)", href: "/qa/comercial" },
      { id: "ops-phase31-staging-dry-run", label: "Phase 31: npm run entitlements:db-push:dry-run OK vs gprmsufvhabntbrytwyi; NO db push real hasta revisión manual", href: "/qa/comercial" },
      { id: "ops-phase32-code-validation", label: "Phase 32: typecheck/build OK; lint + test con fallos reales (no ocultados) — ver docs/COMMERCIAL_ENTITLEMENTS.md", href: "/qa/comercial" },
      { id: "ops-phase33-no-implement", label: "Phase 33: NO implementar aún superadmin UI nueva, Stripe, MP, checkout, pricing, production gating, AI/WA/automations nuevas", href: "/qa/comercial" },
      { id: "ops-phase34-final-report", label: "Phase 34: informe final; NO PRODUCTION IMPACT; migraciones no aplicadas; dry-run staging pendiente de revisión humana", href: "/qa/comercial" },
      { id: "ops-safety-gate-121-128", label: "Safety gate: preflight staging OK; lint PASS; aplicar SOLO 121–128 (no 110–120 juntos) tras revisión dry-run", href: "/qa/comercial" },
    ],
  },
  {
    id: "a11y-visual",
    title: "Legibilidad visual (temas)",
    items: [
      {
        id: "a11y-theme-selector",
        label:
          "Selector de apariencia: títulos, descripciones y cards selected legibles en los 5 estilos × claro/oscuro",
        href: "/configuracion",
      },
      {
        id: "a11y-settings",
        label: "Configuración: labels, helpers y botones sin texto lavado",
        href: "/configuracion",
      },
      {
        id: "a11y-dashboard",
        label: "Dashboard: KPIs, listas y nav lateral legibles",
        href: "/dashboard",
      },
      {
        id: "a11y-sidebar",
        label: "Sidebar: items, activo y muted legibles (claro y oscuro, Soft Clinic/Cobalt/Midnight)",
        href: "/dashboard",
      },
      {
        id: "a11y-patient",
        label: "Ficha de paciente: tabs, banners y formularios legibles",
        href: "/pacientes",
      },
      {
        id: "a11y-history",
        label: "Historia clínica / consultas: tablas, filtros y texto clínico nítidos",
        href: "/historias",
      },
      {
        id: "a11y-appointments",
        label: "Agenda/turnos: celdas, modales y estados selected legibles",
        href: "/agenda",
      },
      {
        id: "a11y-forms-tables",
        label: "Forms y tablas: labels, placeholders, headers y filas hover/selected",
        href: "/pacientes/nuevo",
      },
      {
        id: "a11y-modals",
        label: "Modales/drawers: título, subtítulo, close, footnotes y option cards",
        href: "/configuracion",
      },
      {
        id: "a11y-superadmin",
        label: "Superadmin: tablas, muted y formularios legibles en Midnight/Clinical",
        href: "/superadmin",
      },
      {
        id: "a11y-no-strain",
        label: "Ningún texto visible requiere esfuerzo para leer (criterio clínico)",
      },
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
