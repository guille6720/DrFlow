# DrFlow — Auditoría QA modular (por capas)

Agrupa el código en **módulos funcionales** × **4 capas**:

| Capa | Qué incluye |
|------|-------------|
| **Autenticación** | Middleware, guards, sesión, rutas `/auth/*` |
| **Lógica de negocio / servicios** | Server actions, services, hooks de dominio |
| **Capa de datos / validación** | Repositories, Zod, tipos, migraciones SQL |
| **Interfaz / componentes** | Pages, componentes React, vistas UI |

---

## Cómo usar

### En la app (recomendado)

**Ayuda → Abrir auditoría** o directo:

https://drflow.opusorg.com/ayuda/auditoria-modular

Checklists interactivos, capas expandibles y rutas de código.

### Exportar código completo de un módulo

Desde la raíz del repo:

```bash
node scripts/export-qa-module-code.mjs --list
node scripts/export-qa-module-code.mjs auth
node scripts/export-qa-module-code.mjs pacientes --layer=business
```

Genera archivos en `docs/qa-exports/` con **todo el código fuente** concatenado por módulo/capa.

También hay un JSON por módulo en `docs/qa-modules/` (generado con `npx tsx scripts/sync-qa-auditoria-json.ts`).

### JSON para análisis con IA

Archivo completo (todos los módulos):

**`docs/qa-auditoria-modulos.json`**

Un JSON por módulo (mismo formato que `auth.json`):

**`docs/qa-modules/<moduleId>.json`** — ej. `docs/qa-modules/caja.json`

```bash
npx tsx scripts/sync-qa-auditoria-json.ts
node scripts/export-qa-module-code.mjs caja
```

Ctrl+P → `qa-modules/caja.json`

Fuente de datos: `src/core/qa/modular-audit-layers.ts`

---

## Módulos funcionales

### 1. Autenticación (`auth`)

| Capa | Resumen (3 líneas) |
|------|-------------------|
| Auth | Middleware SSR, cookies Supabase, rutas login/register/auth. **Entradas:** HTTP request, cookies. **Salidas:** redirect /login o sesión activa. |
| Negocio | signUp/signIn/signOut, bootstrap post-login. **Entradas:** FormData email/password. **Salidas:** `{ data \| error }`, clinicId en sesión. |
| Datos | Clientes Supabase, tipos Profile/Clinic, Zod. **Entradas:** queries auth.users. **Salidas:** filas tipadas. |
| UI | Páginas login/registro, Google OAuth. **Entradas:** clicks usuario. **Salidas:** forms + redirect. |

### 2. Permisos (`permissions`)

| Capa | Resumen |
|------|---------|
| Auth | Guards clínica, ownership, tenant scope. **In:** userId, entityId. **Out:** FORBIDDEN o scoped. |
| Negocio | Matriz roles, overrides miembro, isInvited. **In:** role, permissions JSON. **Out:** hasPermission(), nav filtrado. |
| Datos | staff-schemas, clinic_members. **In:** invite payload. **Out:** Zod + filas DB. |
| UI | Matriz permisos, sidebar, badge INVITADO. **In:** rol. **Out:** nav visible/oculto. |

### 3. Pacientes (`pacientes`)

| Capa | Resumen |
|------|---------|
| Negocio | CRUD, workspace tabs, loaders SSR. **In:** patientId, ?tab=. **Out:** workspace payload. |
| Datos | Repository patients, tabs constants. **In:** clinic_id. **Out:** filas patients. |
| UI | Lista, workspace SOAP/órdenes. **In:** props workspace. **Out:** vistas interactivas. |

### 4. Historias clínicas (`historias`)

| Capa | Resumen |
|------|---------|
| Negocio | CRUD SOAP, import CSV/PDF. **In:** FormData SOAP. **Out:** clinical_records. |
| Datos | Tipos EHR, schemas. **In:** payload consulta. **Out:** validación. |
| UI | patient-ehr-view, forms consulta. **In:** dictado, CIE-10. **Out:** UI evolución. |

### 5. Recetas y órdenes (`recetas`)

| Capa | Resumen |
|------|---------|
| Negocio | Prescripciones, órdenes PAMI, audit. **In:** FormData orden. **Out:** documentData + audit. |
| Datos | Repos medical_orders, tipos. **In:** insert/update. **Out:** RepoResult. |
| UI | List, preview, edit, print. **In:** clicks acciones. **Out:** modales + print. |

### 6. Agenda (`agenda`)

| Capa | Resumen |
|------|---------|
| Negocio | Turnos, sala espera, booking público. **In:** fecha, slug. **Out:** appointments. |
| Datos | public-booking Zod. **In:** slot datetime. **Out:** fila insertada. |
| UI | agenda-view, solicitar-turno. **In:** confirm/ausente. **Out:** calendario. |

### 7. Configuración (`configuracion`)

| Capa | Resumen |
|------|---------|
| Negocio | Settings, invitaciones, feature flags. **In:** FormData settings. **Out:** config persistida. |
| Datos | clinics repo, migraciones 071–073. **In:** clinic patch. **Out:** filas validadas. |
| UI | settings-panel, team invite. **In:** sección activa. **Out:** forms. |

### 8. Dashboard (`dashboard`)

| Capa | Resumen |
|------|---------|
| Negocio | Ops dashboard, KPIs, alertas. **In:** clinicId, fecha. **Out:** payload agregado. |
| Datos | Tipos payload dashboard. **In:** queries día. **Out:** tipos TS. |
| UI | clinical-ops-center. **In:** payload SSR. **Out:** KPI cards. |

### 9. Monetización (`billing`)

| Capa | Resumen |
|------|---------|
| Negocio | Planes SaaS, trial, caja lab. **In:** trial_ends_at. **Out:** bloqueo trial. |
| Datos | cash-schemas. **In:** montos ARS. **Out:** validación. |
| UI | /planes, trial banner. **In:** plan click. **Out:** pricing cards. |

### 10. Portal paciente (`portal`)

| Capa | Resumen |
|------|---------|
| Negocio | Portal slug, share link. **In:** slug. **Out:** metadata clínica. |
| Datos | portal_slug types. **In:** anon query. **Out:** branding. |
| UI | patient-portal-view PWA. **In:** nav tabs. **Out:** UI mobile. |

### 11. IA clínica (`ia`) — lab

| Capa | Resumen |
|------|---------|
| Negocio | Copilot, physician assist, API. **In:** contexto paciente. **Out:** sugerencias SOAP. |
| Datos | clinical-ai-api Zod. **In:** JSON API. **Out:** parse. |
| UI | copilot sheets, FAB. **In:** chat/assist. **Out:** UI sugerencias. |

### 12. PAMI cabecera y planillas (`pami`)

| Capa | Resumen |
|------|---------|
| Negocio | Setup cabecera, planillas por categoría, órdenes `pami_form`, vademécum. **In:** patientId, template, FormData. **Out:** planillas + órdenes. |
| Datos | RPC seed cabecera, search vademécum, migración 020. **In:** clinic_id, búsqueda fármaco. **Out:** templates seeded. |
| UI | /pami/planillas, guía PAMI, banner paciente, panel setup. **In:** clicks acciones. **Out:** planillas imprimibles. |

### 13. Datos / RLS (`data`)

| Capa | Resumen |
|------|---------|
| Datos | Supabase, RLS, 75 migraciones. **In:** clinic_id JWT. **Out:** filas scoped. |
| Negocio | Import HCE, migration health. **In:** archivos CSV/PDF. **Out:** pacientes importados. |
| UI | Panel /datos. **In:** upload. **Out:** progress import. |

### 14. Caja / cobranzas (`caja`)

| Capa | Resumen |
|------|---------|
| Auth | Permiso manageCashRegister. **In:** rol. **Out:** redirect si sin permiso. |
| Negocio | Cobros, anulación, cierre. **In:** FormData monto/método. **Out:** cash_charges. |
| Datos | cash-schemas, migración 034. **In:** montos ARS. **Out:** validación. |
| UI | /caja, cierre, cuenta corriente. **In:** clicks cobro. **Out:** UI caja. |

### 15. Profesionales (`profesionales`)

| Capa | Resumen |
|------|---------|
| Auth | Admin/doctor only. **In:** rol. **Out:** FORBIDDEN secretaría. |
| Negocio | Intake, horarios, banco. **In:** FormData intake. **Out:** professionals. |
| Datos | professional-intake Zod. **In:** matrícula/CBU. **Out:** validación. |
| UI | /ingreso-profesionales. **In:** checklist intake. **Out:** UI alta equipo. |

### 16. Reportes (`reportes`)

| Capa | Resumen |
|------|---------|
| Auth | viewReports. **In:** rol. **Out:** redirect. |
| Negocio | Informe mensual, CSV async. **In:** monthStart/End. **Out:** KPIs + export. |
| UI | /reportes. **In:** mes. **Out:** tablero operativo. |

### 17. Auditoría clínica (`auditoria`)

| Capa | Resumen |
|------|---------|
| Auth | can_view_clinical. **In:** patientId. **Out:** trail o vacío. |
| Negocio | logAudit inmutable. **In:** old/new values. **Out:** audit_logs. |
| UI | Tab Auditoría workspace. **In:** expand evento. **Out:** timeline diff. |

### 18. Administración (`administracion`)

| Capa | Resumen |
|------|---------|
| Negocio | Docs admin, sala espera, atenciones. **In:** upload/estado turno. **Out:** docs + cola. |
| UI | /secretaria/documentos, /sala-espera, /atenciones. **In:** acciones secretaría. **Out:** UI admin. |

### 19. Farmacología (`pharmacology`)

| Capa | Resumen |
|------|---------|
| Negocio | Búsqueda CIE-10/síntomas/vademécum. **In:** query. **Out:** sugerencias. |
| Datos | API /api/pharmacology. **In:** JSON. **Out:** parse RPC. |
| UI | /herramientas/farmacologia. **In:** modo tabs. **Out:** typeaheads. |

### 20. Dictado por voz (`voice`)

| Capa | Resumen |
|------|---------|
| Negocio | Web Speech API hook. **In:** micrófono. **Out:** transcript. |
| UI | Provider + textarea SOAP. **In:** click mic. **Out:** dictado inline. |

### 21. Telemedicina (`telemedicina`) — lab

| Capa | Resumen |
|------|---------|
| Negocio | Stub Jitsi por turno. **In:** appointmentId. **Out:** room URL. |
| UI | /telemedicina. **In:** crear sesión. **Out:** link meet.jit.si. |

### 22. Facturación (`facturacion`) — lab

| Capa | Resumen |
|------|---------|
| Negocio | Pagos mock MP. **In:** FormData monto. **Out:** payments paid. |
| UI | /pagos. **In:** simular pago. **Out:** historial mock. |

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/core/qa/modular-audit-layers.ts` | Definición módulos × capas |
| `src/core/components/qa/qa-modular-audit-view.tsx` | UI interactiva |
| `scripts/sync-qa-auditoria-json.ts` | Genera JSON por módulo (formato auth.json) |
| `scripts/export-qa-module-code.mjs` | Export código completo |

Ver también [QA_CHECKLIST.md](./QA_CHECKLIST.md).
