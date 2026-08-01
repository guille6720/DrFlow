# Supabase — migraciones pendientes (producción)

Si ves errores como:

- `Could not find the 'insurance_plan' column of 'patients'`
- `accepted_coverages` / `trial_ends_at` no existe
- Caja, sala de espera o docs administrativos fallan
- Eliminar cuenta no funciona

…faltan migraciones **030 a 041** en tu proyecto Supabase.

---

## Opción A — Terminal (recomendado)

Supabase → **Project Settings → Database** → copiá la connection string.

```powershell
cd c:\dev\DrFlow
$env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
npm run migrate:production-pending
npm run check:supabase
node scripts/check-insurance-plan-column.mjs
```

---

## Opción B — SQL Editor (manual)

Supabase → **SQL Editor** → **New query**

Ejecutá **un archivo por vez**, en este orden (copiá el contenido de cada `.sql`):

| # | Archivo | Qué habilita |
|---|---------|--------------|
| 1 | `supabase/migrations/030_clinic_accepted_coverages.sql` | Coberturas del consultorio |
| 2 | `supabase/migrations/031_google_profile_name.sql` | Nombre con Google login |
| 3 | `supabase/migrations/032_clinic_trial.sql` | Trial 10 días (`trial_ends_at`) |
| 4 | `supabase/migrations/033_legal_compliance.sql` | Términos / privacidad clínica |
| 5 | `supabase/migrations/034_secretaria_caja.sql` | Caja, sala espera, docs admin, `insurance_plan` |
| 6 | `supabase/migrations/035_remove_clinic_user.sql` | Quitar miembros del equipo |
| 7 | `supabase/migrations/036_auth_user_delete_trigger.sql` | Borrar usuarios desde Dashboard |
| 8 | `supabase/migrations/037_fix_cleanup_optional_tables.sql` | Fix cleanup si falta caja |
| 9 | `supabase/migrations/038_fix_cleanup_keep_professionals.sql` | Fix borrado profesionales |
| 10 | `supabase/migrations/039_delete_own_account.sql` | Eliminar mi cuenta (app) |
| 11 | `supabase/migrations/040_delete_own_account_purge_clinic.sql` | Borrar consultorio solo |
| 12 | `supabase/migrations/041_patients_insurance_plan.sql` | Plan de cobertura paciente |

> **Nota 034:** si falla con `type "waiting_room_status" already exists`, esa migración ya corrió parcialmente. Saltá la sección de `CREATE TYPE` y ejecutá el resto, o usá la Opción C.

---

## Opción C — Solo lo mínimo (guardar pacientes)

Si solo querés **guardar pacientes ya**:

```sql
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS insurance_plan TEXT;
```

Para evitar más sorpresas, igual conviene correr **030–041** completas (Opción A o B).

---

## Atajo rápido (columnas frecuentes)

Pegá esto si querés cubrir lo más común sin abrir cada archivo:

```sql
-- 030
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS accepted_coverages TEXT[] NOT NULL DEFAULT '{}';

-- 032
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NULL;

-- 033 (legal)
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS legal_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS legal_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_privacy_version TEXT;

-- 041 / 034
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS insurance_plan TEXT;
```

Esto **no** crea Caja, sala de espera ni funciones de borrado de cuenta. Para el producto completo usá Opción A o B.

---

## Después de aplicar

1. Supabase → **Settings → API** → **Reload schema** (si existe la opción) o esperá 1–2 min.
2. Recargá DrFlow con **Ctrl+F5**.
3. Probá: guardar paciente, configuración → coberturas, caja (si la usás).
