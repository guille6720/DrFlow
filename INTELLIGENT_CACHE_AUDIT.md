# DrFlow — Cache inteligente (PROMPT 05)

**Fecha:** 2026-08-10

## Modelo de tres capas

| Capa | Mecanismo | Alcance |
|------|-----------|---------|
| 1 | `React.cache()` | Dedupe dentro de una petición HTTP |
| 2 | `unstable_cache()` + tags | Cross-request (Data Cache Next.js) |
| 3 | `updateTag()` + `revalidatePath()` | Invalidación tras mutaciones |

**Auth:** el acceso a clínica se valida **antes** de leer cache (session/cookies fuera de `unstable_cache`). Dentro del cache se usa `createAdminClient()` con filtro explícito `clinic_id`.

---

## Qué se cachea

| Recurso | TTL | Tag | Mutaciones que invalidan |
|---------|-----|-----|--------------------------|
| Plugins | 120s | `clinic-{id}-plugins` | `clinic-plugins.ts` |
| Feature flags | 120s | `clinic-{id}-feature-flags` | `clinic-feature-flags.ts` |
| Portal / booking | 300s | `clinic-{id}-portal` | `settings.enablePublicBooking` |
| Profesionales | 300s | `clinic-{id}-professionals` | settings, intake, firmas, doctor-profile |
| Locations | 600s | `clinic-{id}-locations` | settings CRUD |
| Specialties | 600s | `clinic-{id}-specialties` | settings CRUD, doctor-profile |
| Plantillas clínicas | 600s | `clinic-{id}-clinical-templates` | `clinical-templates.ts` |
| Config clínica | 300s | `clinic-{id}-settings` | settings, coverages |
| PAMI planillas | 600s | `clinic-{id}-pami-planillas` | pami admin/setup |
| pathology_drugs | 3600s | `pathology-drugs-{id}` | (referencia global) |

**Firmas URL:** paths en cache DB; `createSignedUrls` se ejecuta por request (TTL storage 1h).

---

## Qué NO se cachea

| Categoría | Ejemplos |
|-----------|----------|
| Tiempo real | turnos, sala de espera, estados de atención |
| PHI | pacientes, historias, adjuntos, órdenes |
| Financiero | caja, movimientos, cierre |
| Auth | sesión, permisos por request |
| Búsquedas ad-hoc | RPC pacientes, patología, vademecum |

---

## Archivos clave

- `src/lib/server/clinic-metadata-unstable-cache.ts` — helper + TTLs
- `src/lib/server/cached-clinic-metadata.ts` — loaders con `unstable_cache`
- `src/lib/server/cached-clinic-queries.ts` — wrappers `React.cache()`
- `src/core/cache/cache-tags.ts` — tags
- `src/core/cache/revalidate-clinic-cache.ts` — `updateTag()` helpers

---

## Consumidores migrados

- `/plantillas` → `getCachedClinicalTemplatesAdmin`
- `/caja` → `getCachedClinicProfessionalsAgenda`, `getCachedClinicSettings`
- `/firmas` (admin) → `getCachedClinicProfessionalsList`
- `/ingreso-profesionales` → `getCachedClinicLocations`
- Turnos config/reportes → cache profesionales + settings
- Historia detail → `getCachedClinicProfessionalsFull`

---

## Invalidación añadida

- `doctor-profile.ts` → professionals + specialties tags
- `professional-signatures.ts` → professionals tag
- `settings.updateClinicSettings` → settings tag
- `coverages.updateClinicCoverages` → settings tag
- `clinical-templates.ts` → path `/historias/[id]/editar`

---

## Fallback sin service role

Si `SUPABASE_SERVICE_ROLE_KEY` no está configurada (tests/local), los loaders usan `createClient()` sin cross-request cache — comportamiento previo preservado.

---

## Medición

Comparar en staging:
- Requests PostgREST repetidos al navegar agenda → pacientes → recetas → historias
- Duración `load_pacientes_page` / layout dashboard antes/después
- Hit rate Data Cache en logs Next.js (si disponible)
