# DrFlow — Guía para asistentes de código (Claude / Cursor)

SaaS clínico argentino: agenda, pacientes, historia clínica, recetas, PAMI, portal paciente PWA.  
Stack: **Next.js 16** (App Router), **Supabase** (Auth + Postgres + RLS + Storage), **Vercel** (`gru1`).

Referencias: `README.md`, `AUDITORIA.md`, `docs/LOCAL_SETUP.md`, `docs/DEPLOY_VERCEL.md`, `AGENTS.md` (reglas Next.js 16).

Producción: **`https://drflow.opusorg.com`** — usar `getPublicSiteUrl()` / `NEXT_PUBLIC_SITE_URL` en emails y OAuth, nunca `localhost` en prod.

**No usar typos:** `drflow.epusorg.com`, `drflow.apus.org.com` u otras variantes no existen y no son el deploy de DrFlow.

---

## Reglas obligatorias en todo cambio

1. **Protección de datos personales**
   - Tratar DNI, HC, contactos y coberturas como datos sensibles (Ley 25.326 / 26.529).
   - No loguear PII en consola, respuestas de error públicas ni `audit_logs.metadata` innecesaria.
   - Respetar **multi-tenant**: toda query/mutación clínica debe acotarse a `clinic_id` del tenant activo; confiar en **RLS** y validar en servidor.
   - Evitar persistir datos clínicos en `localStorage` salvo UX explícita del portal (y documentar limitaciones).
   - Usar `sanitizeText()` (y Zod) en entradas de texto; no confiar solo en el cliente.

2. **Registro de auditoría**
   - Acciones relevantes (acceso denegado, cambios clínicos, exportaciones, altas/bajas sensibles) deben usar `logAudit()` en `src/lib/auth/session.ts`.
   - Acciones permitidas: `create` | `update` | `delete` | `view` | `export`.
   - Metadata: solo lo necesario para trazabilidad (IDs, rutas, motivos); sin contenido clínico completo.

3. **Roles y permisos**
   - Matriz en `src/lib/permissions/roles.ts`: `hasPermission`, `canAccessRoute`.
   - Roles: `superadmin`, `clinic_admin`, `doctor`, `secretary`, `patient`.
   - **Nunca** basar seguridad solo en ocultar ítems del sidebar; validar en **Server Actions**, **API routes** y **layout/guards** del dashboard.
   - Superadmin bypass: coherente con RLS helpers en Supabase.
   - Clínica activa: cookie httpOnly `drflow_clinic_id`; usar `getActiveClinicId()` / `getDashboardShell()`.

4. **OWASP y seguridad**
   - Queries vía Supabase client (parametrizado); RPC con `SECURITY DEFINER` solo donde ya está diseñado.
   - `SUPABASE_SERVICE_ROLE_KEY` solo server-side; minimizar usos (invitaciones, admin); nunca en cliente.
   - No commitear `.env`, claves ni secretos.
   - Endurecer headers (CSP, etc.) cuando se toque infra — ver `vercel.json` y roadmap en `AUDITORIA.md`.
   - Rate limiting deseable en auth y booking público (aún no global en app).

5. **Código limpio**
   - Diff mínimo; convenciones del repo (imports `@/`, Server Actions `"use server"`, Tailwind existente).
   - Sin abstracciones de una línea ni refactors amplios no pedidos.
   - Comentarios solo para lógica no obvia (negocio clínico, RLS, RPC).

6. **No eliminar funcionalidades existentes**
   - Rutas “lab” (`/pagos`, `/telemedicina`, `/qa`, mocks) pueden **ocultarse en nav** o **bloquearse por URL**, pero no borrar módulos/actions salvo pedido explícito del usuario.
   - Mantener compatibilidad con flujos: registro, onboarding, portal, solicitar-turno, PWA consultorio y portal.

7. **Alcance mínimo de archivos**
   - Tocar solo lo necesario para el objetivo; no reformatear ni “limpiar” archivos ajenos.

8. **Proceso antes de codificar**
   - Explicar **qué**, **por qué**, **qué archivos** y riesgos (datos/permisos).
   - **Esperar aprobación** del usuario antes de aplicar cambios, salvo que diga explícitamente “aplicá directo” o pida crear/editar un archivo concreto (ej. este `CLAUDE.md`).

9. **Git**
   - No hacer commit ni push salvo pedido explícito.
   - No `--force` a main; no saltear hooks.

---

## Arquitectura DrFlow (recordatorio)

| Capa | Ubicación |
|------|-----------|
| Rutas UI | `src/app/(dashboard)/`, `(auth)/`, `portal/`, `solicitar-turno/` |
| Mutaciones | `src/lib/actions/*` |
| APIs | `src/app/api/*` (auth, farmacología, version) |
| Sesión / tenant | `src/lib/auth/session.ts` |
| Supabase | `src/lib/supabase/server.ts`, `middleware.ts` |
| Esquema + RLS | `supabase/migrations/` (aplicar en orden; ver última migración en repo) |
| Tests unitarios | `tests/` (Vitest); `npm run lint`, `npm test`, `npm run build` |

**Patrones a respetar**

- Login de formulario: `POST /api/auth/login` (no depender de `signIn()` en `auth.ts` para UI nueva).
- URLs públicas: `getPublicSiteUrl()` desde `src/lib/supabase/env.ts`.
- Dashboard: preferir `getDashboardShell()` en layout; evitar duplicar fetches en páginas nuevas.
- Farmacología: API y actions con permiso `viewPharmacology`.
- Portal paciente: ruta `/portal/[slug]`; SW separado (`sw-portal.js`).

---

## Producto y UX

- Copy orientado a **consultorio argentino**; tono claro y humano (auth, errores, portal).
- **Nav clínico** (sidebar): sin Telemedicina, Pagos ni Checklist QA para usuarios normales; lab solo superadmin vía URL/guard (ver roadmap P0 en `AUDITORIA.md`).
- Promoción **30 días**: debe reflejarse en BD (`trial_ends_at`) cuando esté implementado; no solo marketing.
- Manual y versiones: `src/lib/manual/`, `src/lib/app-release.ts`, `/ayuda`, `UpdateBanner`.
- Invitaciones WhatsApp prueba: `/probar` → `/register?trial=30`.

---

## Base de datos y migraciones

- Nueva migración: siguiente número secuencial en `supabase/migrations/` (ej. `032_*.sql`).
- Tras cambios de esquema: actualizar `src/types/database.ts` o generar tipos con Supabase CLI si el proyecto lo adopta.
- Documentar en commit/PR si prod debe ejecutar SQL manual en Supabase.
- RLS es la línea de defensa principal; cualquier tabla clínica nueva necesita políticas.

---

## Variables de entorno

Ver `.env.example`. Obligatorias para build/CI: `NEXT_PUBLIC_SUPABASE_URL`, clave publishable/anon, `NEXT_PUBLIC_SITE_URL`.

Opcionales: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_SHOW_LABS` (legacy sidebar labs).

---

## Checklist rápido antes de cerrar un PR / entrega

- [ ] Permisos comprobados en action/API/página tocada
- [ ] Sin fugas cross-tenant (`clinic_id`)
- [ ] Sin PII en logs/metadata de auditoría superflua
- [ ] `npm run lint` y `npm test` (y build si hubo cambios estructurales)
- [ ] Migración SQL incluida si hubo cambio de esquema
- [ ] Funcionalidad existente intacta (incl. lab y portal)

---

## Roadmap de auditoría (prioridad)

Ver **`AUDITORIA.md`** — P0 incluye route guards, trial real, RLS/tests cross-tenant. Alinear entregas con ese documento salvo que el usuario indique otra prioridad.
