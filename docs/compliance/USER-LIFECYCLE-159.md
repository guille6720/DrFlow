# Ciclo de vida seguro de usuarios — migración 159

## Problema

Supabase Auth devolvía `Database error deleting user` al borrar `auth.users`: el CASCADE a `profiles` chocaba con FKs de historias, auditorías y módulos posteriores a la migración 094.

## Solución

Migración: `supabase/migrations/159_secure_user_lifecycle.sql`

| Acción | RPC | Efecto |
|--------|-----|--------|
| Desactivar | `admin_deactivate_clinic_member` | `clinic_members.is_active=false`, `profiles.account_status=disabled`, revoca device sessions; app banea Auth |
| Reactivar | `admin_reactivate_clinic_member` | Reactiva membership + profile; app unbanea Auth |
| Desvincular | `admin_unlink_clinic_member` | Quita membership de la clínica; desvincula `professionals.user_id` de esa clínica; no borra Auth |
| Eliminar definitivamente | `admin_permanently_delete_clinic_user` | Cleanup de FKs + `DELETE auth.users` (libera email); conserva profesional + HC |

Protecciones:

- Último `clinic_admin` activo bloqueado (`LAST_CLINIC_ADMIN`)
- No se borran pacientes ni HC
- No se reescribe autoría clínica a otro usuario vivo (`created_by` / `changed_by` → NULL; identidad vía `professional_id`)
- No se desactiva RLS
- Confirmación por email en UI antes del hard-delete
- Auditoría en `audit_logs` desde server actions

## UI

- Superadmin → Clínica → **Usuarios de la clínica**
- Configuración → Equipo / Médicos → Equipo

## Staging

```powershell
$env:ALLOW_STAGING_DB_PUSH="1"
$env:CONFIRM_STAGING_DB_PUSH="gprmsufvhabntbrytwyi"
npm run supabase:db-push:staging

npx supabase db query --linked -f supabase/migrations/rollback/VERIFY_USER_LIFECYCLE_159_staging.sql
```

Smoke sintético (opcional): `node scripts/user-lifecycle-staging-smoke.mjs` con env documentados en el script.

## Producción

Solo tras:

1. Verify SQL OK en staging
2. Smoke sintético PASS
3. Respaldo / procedimiento de recuperación confirmado
4. Push controlado a `nipqdarduknydqptqzup` (nunca con el script de staging)
