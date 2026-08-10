# Estrategia de caché — DrFlow

Informe de auditoría e implementación (2026-07-30).

## Resumen

DrFlow usa una estrategia en **tres capas** (actualizado 2026-08-10):

| Capa | Mecanismo | Alcance | Uso |
|------|-----------|---------|-----|
| 1 | `React.cache()` | Una petición HTTP | Dedupe de sesión, perfil, clínicas y lecturas repetidas en la misma renderización |
| 2 | `unstable_cache()` + tags | Cross-request (Data Cache de Next.js) | Metadatos semi-estáticos de clínica vía `createAdminClient()` + filtro `clinic_id` |
| 3 | `updateTag()` + `revalidatePath()` | Invalidación | Tras mutaciones en server actions |

**Auth gate:** cookies/sesión fuera del cache. Ver `INTELLIGENT_CACHE_AUDIT.md` para detalle completo.

**Fallback:** sin `SUPABASE_SERVICE_ROLE_KEY`, capa 2 desactivada — solo dedupe por request.

---

## Datos cacheados (implementado)

### Sesión y shell (`React.cache()` — ya existía)

- `getSession`, `getProfile`, `getUserClinics`, `getActiveClinic`, `getDashboardShell`
- **Archivo:** `src/core/auth/session.ts`
- **Motivo:** Cada página del dashboard invocaba 3–5 helpers de sesión; `cache()` deduplica dentro del request.

### Plugins y feature flags (`unstable_cache` + `React.cache`)

- **TTL:** 120 s
- **Tags:** `clinic-{id}-plugins`, `clinic-{id}-feature-flags`
- **Archivos:** `cached-clinic-metadata.ts`, `cached-clinic-queries.ts`
- **Invalidación:** `updateClinicPlugin`, `updateClinicFeatureFlag`

### Portal / booking slug (`unstable_cache` + derivación)

- **TTL:** 300 s — tag `clinic-{id}-portal`
- **Optimización:** `getCachedActiveBookingSlug` ya no hace query propia; deriva el slug de `getCachedPortalContext` (elimina duplicado en agenda/config/pacientes).
- **Invalidación:** `enablePublicBooking` en settings

### Metadatos de clínica (professionals, locations, specialties, templates)

| Recurso | TTL | Tag | Consumidores actualizados |
|---------|-----|-----|---------------------------|
| Professionals (agenda) | 300 s | `clinic-{id}-professionals` | `/agenda` |
| Professionals (forms) | 300 s | mismo tag | workspace paciente, `/historias/nueva` |
| Professionals (recetas) | 300 s | mismo tag | `load-recetas-page.ts` |
| Professionals (settings) | 300 s | mismo tag | `/configuracion` (incluye inactivos) |
| Locations | 600 s | `clinic-{id}-locations` | `/agenda` |
| Specialties | 600 s | `clinic-{id}-specialties` | `/agenda` |
| Clinical templates | 600 s | `clinic-{id}-clinical-templates` | workspace, `/historias/nueva`, `/historias/[id]/editar`, `/plantillas` (admin) |
| Clinic settings | 300 s | `clinic-{id}-settings` | turnos config, caja (doctors_can_access_cash) |

**Invalidación:** `settings.ts` (CRUD specialties/locations/professionals, portal), `professional-intake.ts` (alta/edición de profesionales).

### Referencia farmacológica global

- **`pathology_drugs` por `pathology_id`**
- **TTL:** 3600 s — tag `pathology-drugs-{pathologyId}`
- **Archivo:** `cached-reference-data.ts`
- **Consumidores:** `getDrugsByPathology` (server action), `GET /api/pharmacology?pathologyId=`
- **Nota:** Búsquedas RPC (`search_pathologies`, `search_symptoms`, PAMI) **no** se cachean — son consultas ad-hoc del usuario.

---

## Datos explícitamente NO cacheados

| Categoría | Ejemplos | Motivo |
|-----------|----------|--------|
| **PHI / clínico** | `patients`, `clinical_records`, adjuntos, perfiles clínicos | Datos sensibles; deben reflejar ediciones inmediatas |
| **Tiempo real / ops** | `appointments`, `prescription_drafts`, `medical_orders`, sala de espera | Realtime Supabase + polling 30 s |
| **Auth** | tokens, sesión Supabase, permisos por request | Seguridad |
| **Caja / facturación** | movimientos, cierre de caja | Integridad financiera |
| **IA / copilot** | respuestas generadas | No determinísticas; contexto del paciente |
| **Cron / jobs** | `/api/jobs/process`, `/api/observability/purge` | `dynamic = "force-dynamic"` + `Cache-Control: no-store` |

---

## Archivos nuevos

```
src/core/cache/cache-tags.ts           — constantes de tags
src/core/cache/revalidate-clinic-cache.ts — helpers updateTag
src/lib/server/clinic-metadata-unstable-cache.ts — helper unstable_cache + TTLs
src/lib/server/cached-clinic-metadata.ts  — loaders por recurso
src/lib/server/cached-reference-data.ts   — pathology_drugs cacheado
```

## Archivos modificados (consumidores + invalidación)

- `src/lib/server/cached-clinic-queries.ts` — wrappers React.cache + exports metadata
- `src/app/(dashboard)/agenda/page.tsx`
- `src/app/(dashboard)/configuracion/page.tsx`
- `src/app/(dashboard)/historias/nueva/page.tsx`
- `src/app/(dashboard)/historias/[id]/editar/page.tsx`
- `src/features/pacientes/server/load-patient-workspace-page.ts`
- `src/features/recetas/server/load-recetas-page.ts`
- `src/lib/actions/pharmacology.ts`
- `src/app/api/pharmacology/route.ts`
- `src/lib/actions/clinic-plugins.ts`
- `src/lib/actions/clinic-feature-flags.ts`
- `src/lib/actions/settings.ts`
- `src/lib/actions/professional-intake.ts`
- `src/app/api/jobs/process/route.ts`
- `src/app/api/observability/purge/route.ts`

---

## Impacto esperado

1. **Menos round-trips a Supabase** en navegación entre agenda ↔ pacientes ↔ recetas ↔ historias (mismos professionals/locations/specialties/templates).
2. **Eliminación de query duplicada** `public_booking_links` (portal context compartido).
3. **Referencia farmacológica** reutilizable entre usuarios autenticados de la misma instancia (sin PHI).
4. **Consistencia:** cambios en configuración invalidan tags antes del próximo TTL; `revalidatePath` sigue refrescando UI tras mutaciones.

---

## Mantenimiento

Al añadir un nuevo recurso semi-estático:

1. Definir tag en `cache-tags.ts`
2. Crear loader con `unstable_cache` en `cached-clinic-metadata.ts` o `cached-reference-data.ts`
3. Exponer wrapper `React.cache()` en `cached-clinic-queries.ts` si se usa en Server Components
4. Llamar `revalidate*Cache(clinicId)` en la server action que muta el recurso
5. Documentar TTL y exclusión en esta tabla
