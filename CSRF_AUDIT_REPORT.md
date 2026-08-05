# Informe de Auditoría — CSRF (POST / PUT / PATCH / DELETE)

**Fecha:** 2026-08-04  
**Alcance:** Route Handlers (`src/app/api/**`), Server Actions (`"use server"`), formularios HTML clásicos  
**Estado post-refactor:** rutas cookie-authenticated protegidas; quality gate pendiente de corrida local

---

## Resumen ejecutivo

| Métrica | Resultado |
|---------|-----------|
| Route Handlers con mutación (POST/PUT/PATCH/DELETE) | **7** (solo POST) |
| PUT / PATCH / DELETE en API | **0** |
| Server Action modules (`"use server"`) | **39** |
| Mutaciones sin protección CSRF explícita (pre-audit) | **2** (`/api/clinical-ai`, `/api/admin-ops-ai`) |
| Mutaciones sin protección (post-audit) | **0** |
| Riesgo global | **Bajo** — defense in depth aplicada |

---

## Modelo de amenaza

DrFlow usa **cookies HttpOnly** (Supabase Auth + cookie de clínica activa). Cualquier endpoint que:

1. Acepte POST/PUT/PATCH/DELETE, y  
2. Autentique vía cookie de sesión  

…es vulnerable a **CSRF** si un sitio malicioso puede hacer que el navegador del usuario envíe la request con cookies adjuntas.

Mitigaciones en capas:

| Capa | Mecanismo |
|------|-----------|
| Cookies | `SameSite=Lax` en sesión y clínica activa |
| Server Actions (Next.js 16) | Validación de `Origin` + action IDs firmados |
| Route Handlers auth | `isSameOriginPost()` — Origin/Referer vs Host |
| Route Handlers JSON autenticados | `requireSameOriginMutation()` *(nuevo)* |
| Cron / workers | `Authorization: Bearer CRON_SECRET` — sin cookies |

---

## Inventario — Route Handlers

| Ruta | Método | Auth | Protección CSRF | Estado |
|------|--------|------|-----------------|--------|
| `/api/auth/login` | POST | Form (anon) | `isSameOriginPost` | ✅ Pre-existente |
| `/api/auth/reset-password` | POST | Form (anon) | `isSameOriginPost` | ✅ Pre-existente |
| `/api/auth/signout` | POST | Cookie sesión | `isSameOriginPost` | ✅ Pre-existente |
| `/api/clinical-ai` | POST | Cookie sesión + permisos | `requireSameOriginMutation` | ✅ **Añadido** |
| `/api/admin-ops-ai` | POST | Cookie sesión + permisos | `requireSameOriginMutation` | ✅ **Añadido** |
| `/api/jobs/process` | POST, GET | Bearer `CRON_SECRET` | No aplica (sin cookies) | ✅ Aceptable |
| `/api/observability/purge` | POST, GET | Bearer `CRON_SECRET` | No aplica (sin cookies) | ✅ Aceptable |

**Rutas solo lectura (GET):** `/api/health`, `/api/health/ready`, `/api/health/live`, `/api/version`, `/api/pharmacology`, `/api/command-palette/patients` — fuera de alcance CSRF.

**Auth OAuth:** `/auth/callback`, `/auth/confirm` — solo GET (redirect Supabase); no mutan estado vía POST desde la app.

---

## Inventario — Server Actions

Todas las mutaciones de negocio usan **Next.js Server Actions** (`"use server"`), invocadas desde formularios React o `formAction`. Next.js 16 valida automáticamente que el header `Origin` (o `x-forwarded-host`) coincida con el host de la aplicación antes de ejecutar la acción.

| Área | Módulos | Mutaciones exportadas (aprox.) |
|------|---------|--------------------------------|
| Auth / cuenta | `auth.ts`, `account.ts`, `user-account.ts` | signIn, signUp, signOut, deleteMyAccount, setupClinic |
| Pacientes | `features/pacientes/actions/*` | CRUD paciente, adjuntos, indicadores, share |
| Historia clínica | `features/historias/actions/*` | registros clínicos |
| Recetas / órdenes | `features/recetas/actions/*` | prescripciones, órdenes médicas |
| Agenda / sala | `appointments.ts`, `waiting-room.ts` | turnos, estados, consulta |
| Caja | `cash-register.ts` | cargos, anulaciones, cierre |
| Configuración | `settings.ts`, `coverages.ts`, plugins, flags | clínica, especialidades, sedes |
| Importaciones | `patient-import.ts`, `hce-import.ts`, `clinical-import.ts`, jobs | colas batch |
| Compliance | `compliance.ts`, `clinic-purge.ts` | ARCO, purge, legal |
| Público | `public-booking.ts` | reserva/cancelación portal (anon + slug) |
| Otros | invitations, demo-data, pharmacology, etc. | varios |

**Protección:** Framework-level (Origin check + POST-only + action binding). No se requiere token CSRF manual adicional; añadirlo duplicaría la protección nativa sin cambiar el modelo de amenaza.

**Nota portal público:** `submitPublicBooking` y `cancelPatientAppointment` no usan cookie de sesión DrFlow; el riesgo CSRF es limitado (no hay sesión que secuestrar), pero Next.js igualmente valida Origin en la invocación de la Server Action.

---

## Inventario — Formularios HTML clásicos

| Formulario | Target | Protección |
|------------|--------|------------|
| Login | `POST /api/auth/login` | `isSameOriginPost` en route |
| Reset password | `POST /api/auth/reset-password` | `isSameOriginPost` en route |
| Sign out (sidebar, trial) | `POST /api/auth/signout` | `isSameOriginPost` en route |

Los formularios de registro/onboarding invocan Server Actions vía JavaScript (`signUpClinic`, `setupClinic`) — protección Next.js.

---

## Cambios implementados

### 1. `src/core/security/csrf.ts`

- **`isSameOriginRequest(request)`** — acepta `Request` y `NextRequest` (generalización).
- **`requireSameOriginMutation(request)`** — retorna `403 Forbidden` JSON o `null`.
- **`isSameOriginPost`** — alias retrocompatible.

### 2. Route Handlers protegidos

```typescript
// clinical-ai/route.ts, admin-ops-ai/route.ts
const csrfBlock = requireSameOriginMutation(request);
if (csrfBlock) return csrfBlock;
```

Comportamiento funcional intacto: requests legítimas same-origin (fetch/form desde la app) incluyen `Origin` o `Referer` y pasan la validación.

### 3. Tests

- **`tests/csrf-audit.test.ts`** — helpers + scan estático de todas las rutas mutación en `src/app/**/route.ts`.

---

## Hallazgos y decisiones

| # | Hallazgo | Severidad | Acción |
|---|----------|-----------|--------|
| 1 | `/api/clinical-ai` POST sin check Origin | Media | ✅ `requireSameOriginMutation` |
| 2 | `/api/admin-ops-ai` POST sin check Origin | Media | ✅ `requireSameOriginMutation` |
| 3 | Server Actions sin token CSRF explícito | Info | ✅ Aceptable — Next.js 16 Origin validation |
| 4 | Cron routes sin CSRF clásico | Info | ✅ Aceptable — Bearer secret, no cookies |
| 5 | Cookies `SameSite=Lax` | Info | ✅ Capa adicional; no sustituye Origin check en POST JSON |
| 6 | No hay PUT/PATCH/DELETE en API | Info | N/A — superficie reducida |

### Riesgo residual (bajo)

1. **Subdominios compartidos:** si múltiples apps corren bajo el mismo registrable domain sin aislamiento, un subdominio comprometido podría enviar Origin válido. Mitigación: despliegue en dominio dedicado (práctica actual en Vercel).
2. **Endpoints JSON no usados desde UI hoy:** `clinical-ai` / `admin-ops-ai` tienen copilot client-side directo; las rutas API quedan protegidas para uso futuro o integraciones same-origin.

---

## Verificación

```bash
npm run test -- tests/csrf-audit.test.ts tests/lib-csrf.test.ts
npm run quality-gate   # suite completa
```

Criterios de aceptación del scan estático:

- Toda ruta con `export async function POST|PUT|PATCH|DELETE` contiene `isSameOriginPost`, `isSameOriginRequest`, `requireSameOriginMutation`, o `authorizeCronRequest`.
- Auth routes mantienen `isSameOriginPost`.
- Módulos en `**/actions/*.ts` con exports async incluyen `"use server"`.

---

## Recomendaciones opcionales (fuera de alcance)

1. Middleware centralizado para rechazar mutaciones cross-origin en `/api/*` cookie-auth (DRY; hoy cubierto por route-level).
2. Documentar en runbook que scripts ops deben usar `Authorization: Bearer $CRON_SECRET`, no cookies.
3. Si se añaden webhooks POST con cookies en el futuro, evaluar tokens CSRF por sesión o HMAC de payload.

---

## Conclusión

La superficie de mutación HTTP está acotada a **7 POST handlers** y **~39 módulos Server Action**. Tras el refactor, **100% de route handlers con cookies o formularios clásicos** validan same-origin; los workers cron usan autenticación Bearer independiente de CSRF. El comportamiento funcional de la aplicación no cambia para usuarios legítimos.
