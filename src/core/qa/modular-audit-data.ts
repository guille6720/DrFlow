export type ModularAuditModule = {
  id: string;
  layer: string;
  status: "ready" | "lab" | "planned";
  summary: string;
  inputs: string;
  outputs: string;
  entryPoints: string[];
  checks: { id: string; label: string; href?: string }[];
};

export const MODULAR_QA_AUDIT: ModularAuditModule[] = [
  {
    id: "auth",
    layer: "Plataforma",
    status: "ready",
    summary: "Login, registro, OAuth, refresh SSR y bootstrap post-login.",
    inputs: "Credenciales, tokens OAuth, cookies Supabase.",
    outputs: "Sesión userId/clinicId/role, redirects, errores auth.",
    entryPoints: [
      "src/core/auth/session.ts",
      "src/lib/actions/auth.ts",
      "src/app/api/auth/login/route.ts",
      "src/app/(auth)/login/page.tsx",
    ],
    checks: [
      { id: "mod-auth-login", label: "Login válido redirige a dashboard", href: "/login" },
      { id: "mod-auth-expired", label: "Sesión expirada redirige a /login" },
      { id: "mod-auth-register", label: "Registro crea clínica + admin", href: "/register" },
      { id: "mod-auth-signout", label: "Cerrar sesión limpia la sesión" },
    ],
  },
  {
    id: "permissions",
    layer: "Plataforma",
    status: "ready",
    summary: "Matriz de roles, overrides por miembro, guards multi-tenant.",
    inputs: "Rol, ruta, IDs recurso, overrides JSON.",
    outputs: "hasPermission(), nav filtrado, FORBIDDEN.",
    entryPoints: [
      "src/core/permissions/roles.ts",
      "src/core/services/clinical-access.service.ts",
      "src/core/security/ownership-guard.ts",
    ],
    checks: [
      { id: "mod-perm-sec", label: "Secretaría no accede a HC clínica completa", href: "/historias" },
      { id: "mod-perm-inv", label: "Invitado ve badge INVITADO y Cambiar estilo", href: "/dashboard" },
      { id: "mod-perm-admin", label: "Admin accede a Configuración", href: "/configuracion" },
      { id: "mod-perm-tenant", label: "Usuario no ve datos de otra clínica" },
    ],
  },
  {
    id: "pacientes",
    layer: "Feature",
    status: "ready",
    summary: "Workspace clínico: HC, órdenes, recetas, timeline.",
    inputs: "patientId, tab (soap/ordenes), FormData.",
    outputs: "Vistas paciente, mutaciones, URLs con tab.",
    entryPoints: [
      "src/app/(dashboard)/pacientes/[id]/page.tsx",
      "src/features/pacientes/components/pacientes/patient-workspace-content.tsx",
    ],
    checks: [
      { id: "mod-pat-hc", label: "Tab HC legible en dark/cobalt", href: "/pacientes" },
      { id: "mod-pat-ord", label: "Órdenes: preview, imprimir, editar, eliminar", href: "/pacientes" },
      { id: "mod-pat-voice", label: "Dictado en nueva consulta", href: "/pacientes" },
      { id: "mod-pat-back", label: "Volver desde sub-tabs respeta navegación", href: "/pacientes" },
    ],
  },
  {
    id: "historias",
    layer: "Feature",
    status: "ready",
    summary: "EHR: consultas SOAP, evoluciones, import clínico.",
    inputs: "clinicalRecordId, FormData SOAP.",
    outputs: "Registros clínicos, timeline evoluciones.",
    entryPoints: [
      "src/features/historias/actions/clinical-records.ts",
      "src/features/historias/components/historias/patient-ehr-view.tsx",
    ],
    checks: [
      { id: "mod-hc-soap", label: "Nueva consulta guarda SOAP completo", href: "/historias/nueva" },
      { id: "mod-hc-tables", label: "Tablas diagnósticos/tratamientos legibles", href: "/historias" },
    ],
  },
  {
    id: "recetas",
    layer: "Feature",
    status: "ready",
    summary: "Prescripciones y órdenes PAMI con preview/imprimir/editar.",
    inputs: "FormData orden/receta, patientId, professionalId.",
    outputs: "Documentos imprimibles, filas DB, audit.",
    entryPoints: [
      "src/features/recetas/actions/medical-orders.ts",
      "src/features/recetas/components/recetas/medical-order-list.tsx",
    ],
    checks: [
      { id: "mod-rx-preview", label: "Preview orden con contraste correcto", href: "/pacientes" },
      { id: "mod-rx-print", label: "Imprimir no abre pantalla en blanco", href: "/pacientes" },
      { id: "mod-rx-edit", label: "Editar orden guarda cambios", href: "/pacientes" },
      { id: "mod-rx-del", label: "Eliminar anula la orden", href: "/pacientes" },
    ],
  },
  {
    id: "configuracion",
    layer: "Feature",
    status: "ready",
    summary: "Equipo, invitaciones, permisos, apariencia, plugins.",
    inputs: "Settings, emails invitación, matriz permisos.",
    outputs: "Config persistida, miembros activos.",
    entryPoints: [
      "src/app/(dashboard)/configuracion/page.tsx",
      "src/lib/actions/invitations.ts",
    ],
    checks: [
      { id: "mod-cfg-invite", label: "Invitar médico/secretaria", href: "/configuracion" },
      { id: "mod-cfg-perm", label: "Matriz permisos persiste", href: "/configuracion" },
    ],
  },
  {
    id: "dashboard",
    layer: "Feature",
    status: "ready",
    summary: "Centro operaciones: cola, alertas, KPIs.",
    inputs: "clinicId, fecha, permisos.",
    outputs: "Payload agregado operaciones.",
    entryPoints: ["src/app/(dashboard)/dashboard/page.tsx"],
    checks: [
      { id: "mod-dash-kpi", label: "KPIs cargan sin error", href: "/dashboard" },
      { id: "mod-dash-links", label: "Accesos rápidos respetan permisos", href: "/dashboard" },
    ],
  },
  {
    id: "data",
    layer: "Datos",
    status: "ready",
    summary: "Supabase, repos, 75 migraciones SQL con RLS.",
    inputs: "Queries, clinic_id, IDs entidad.",
    outputs: "Filas DB tipadas, errores repo.",
    entryPoints: [
      "src/core/supabase/server.ts",
      "supabase/migrations/071_clinic_member_permissions_and_shared_ai.sql",
    ],
    checks: [
      { id: "mod-data-rls", label: "RLS bloquea otra clínica" },
      { id: "mod-data-mig", label: "Migraciones 071–073 aplicadas en prod" },
    ],
  },
];

export function modularAuditStats(checked: Record<string, boolean>) {
  const items = MODULAR_QA_AUDIT.flatMap((m) => m.checks);
  const done = items.filter((i) => checked[i.id]).length;
  return {
    done,
    total: items.length,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
    modules: MODULAR_QA_AUDIT.length,
  };
}
