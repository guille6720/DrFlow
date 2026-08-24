# No romper usuarios actuales — Fase 29

> Las clínicas legítimas deben conservar datos y acceso.  
> **Sin aprobación explícita** no se: borran clínicas/pacientes, resetean suscripciones, cambian owners, quitan permisos legítimos ni destruyen HC.

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

Catálogo: `src/core/compliance/user-preservation.ts`

---

## Invariantes

| Prohibido sin aprobación | En migraciones 132–137 |
|--------------------------|-------------------------|
| Delete clinics | No |
| Delete patients | No |
| Reset subscriptions | No (137 solo `CREATE OR REPLACE FUNCTION`) |
| Change owners | No |
| Remove legitimate permissions | No |
| Destroy clinical records | No |

---

## Qué sí cambia (sin borrar datos)

- RLS / RPC API pública más estrictos (bloquea **cross-tenant ilegítimo**; el propio consultorio sigue).
- Storage privado y exports con TTL.
- Cancelación **opt-in** (admin de configuración) — no reset masivo.
- Cola ARCO nueva; no dispara hard-delete de HC.

---

## Verificación staging (read-only) — corrida 2026-08-24

```bash
npx supabase db query --linked -f supabase/migrations/rollback/VERIFY_USER_PRESERVATION_staging.sql
```

Resultado observado (staging linkeado): clínicas **2**, pacientes **130**, HC **552**, miembros **1**, suscripciones **0**. Tablas accesibles (no wipe).

---

## Veredicto técnico

**OK** — El trabajo de compliance no incluye operaciones de destrucción de clínicas, pacientes, HC, owners ni reset masivo de suscripciones.

Cualquier purge/reset futuro (p. ej. `ALLOW_CLINICAL_HISTORY_RESET`) sigue exigiendo **aprobación explícita** y no forma parte de 132–137.

*No garantiza que un admin humano no cancele su propio plan (eso es self-serve intencional).*
