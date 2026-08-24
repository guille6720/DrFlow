# Migraciones de base de datos — Fase 27

> Migraciones de compliance **132–137**: reversibilidad razonable, verificación staging,  
> compatibilidad legacy / RLS. **DO NOT execute production migrations.**

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

Catálogo: `src/core/compliance/database-migrations.ts`

---

## Migraciones del trabajo de compliance

| Archivo | Fase | Aditiva | Reversible | Daña clínicas existentes* |
|---------|------|---------|------------|---------------------------|
| `132_audit_log_security.sql` | Audit | Sí | Sí | No |
| `133_tenant_isolation_public_api.sql` | Tenant API | No (RPC) | Parcial | No |
| `134_consent_management.sql` | Consent | Sí | Parcial | No |
| `135_privacy_rights_requests.sql` | Privacy | Sí | Sí | No |
| `136_storage_security.sql` | Storage | No (policies) | Parcial | No |
| `137_subscription_cancellation.sql` | Cancel | Función | Función | No |

\*Si se aplican correctamente en staging — no hacen DELETE de clínicas/usuarios/HC.

---

## Reversibilidad

Scripts en `supabase/migrations/rollback/`:

- `132_audit_log_security.down.sql`
- `133_tenant_isolation_public_api.down.sql` (**parcial** — no restaura cuerpos `api_*`)
- `134_consent_management.down.sql` (**parcial**)
- `135_privacy_rights_requests.down.sql`
- `136_storage_security.down.sql` (**parcial**; mantiene bucket privado)
- `137_subscription_cancellation.down.sql`

---

## Staging (no producción)

1. `npm run supabase:preflight:staging`
2. Dry-run / review  
3. Apply solo con gates:
   - `ALLOW_STAGING_DB_PUSH=1`
   - `CONFIRM_STAGING_DB_PUSH=<ref-staging>`
   - `npm run supabase:db-push:staging`
4. Verificar:
   - `npm run compliance:migrations:verify-staging`
   - SQL: `supabase/migrations/rollback/VERIFY_132_137_staging.sql`

**Prohibido:** `ALLOW_PRODUCTION_DB`, push a ref de producción, o `migrate:production-pending` como parte de esta fase.

---

## Checks post-migración

| Check | Cómo |
|-------|------|
| Clínicas/usuarios intactos | `SELECT count(*) FROM clinics/profiles` en verify SQL |
| RLS | `privacy_rights_requests.relrowsecurity`, storage `public=false` |
| Legacy | Columnas nuevas con `IF NOT EXISTS` / `CREATE OR REPLACE` |
| Función 137 | `clinic_subscription_active` incluye `canceled` paid-through |

---

## Estado de prueba staging (corrida Fase 27)

| Paso | Resultado |
|------|-----------|
| Preflight staging | **PASS** (linked `gprmsufvhabntbrytwyi`) |
| Verify SQL 132–137 | **PASS** — todos los flags `true` (audit, API gate, consent, privacy RLS, storage private, canceled paid-through, clinics/profiles legibles) |
| Apply push | No requerido en esta corrida (objetos ya presentes en staging) |
| Producción | **No ejecutada** |

---

## Veredicto técnico

**OK** — Migraciones creadas, rollbacks razonables, verify staging documentado/automatizado (gate anti-prod).  
Aplicación real en staging queda a cargo del operador con confirmación explícita.

*No se ejecutaron migraciones de producción en esta fase.*
