# Migraciones Supabase — DrFlow

Aplicar en **orden lexicográfico** (`001` … `032`) en proyecto nuevo.  
En producción existente, aplicar solo archivos **pendientes** (idempotentes cuando sea posible).

---

## Estado del repositorio (032 archivos)

| Rango | Contenido |
|-------|-----------|
| 001–002 | Schema + RLS base |
| 003–004 | Seed + booking público |
| 005–011 | Farmacología |
| 012–019 | Demo, invitaciones, features |
| 020–025 | PAMI, portal, onboarding médico |
| 026–029 | Cancelaciones, storage, modalidad consulta |
| **030** | `accepted_coverages` + RPC PAMI |
| **031** | Google OAuth → `profiles.full_name` |
| **032** | `trial_ends_at` (prueba 10 días) |
| **041** | `patients.insurance_plan` (plan de cobertura) |

---

## Producción — P0 pendiente típico (030–032)

Si el deploy menciona migraciones solo hasta 020, faltan **030–032** (y posiblemente 021–029).

### Opción A — Script (recomendado)

PowerShell, con contraseña de **Supabase → Database**:

```powershell
cd c:\dev\DrFlow
$env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.TU_REF.supabase.co:5432/postgres"
npm run migrate:p0
npm run check:supabase
```

### Opción B — SQL Editor

Pegar y ejecutar **en orden**, uno por archivo:

1. `supabase/migrations/030_clinic_accepted_coverages.sql`
2. `supabase/migrations/031_google_profile_name.sql`
3. `supabase/migrations/032_clinic_trial.sql`
4. `supabase/migrations/041_patients_insurance_plan.sql`

### Opción C — Todas desde cero en entorno vacío

```powershell
npm run migrate:remote
```

*(Puede fallar si objetos ya existen; usar A o B en prod con datos.)*

---

## Verificación post-migración

```powershell
npm run check:supabase
node scripts/check-coverages-column.mjs
node scripts/check-trial-column.mjs
```

- Coberturas en configuración / atenciones
- Registro Google con nombre visible
- Trial `trial_ends_at` al registrarse con `/register?trial=30`

---

## Referencias

- Setup local: `docs/LOCAL_SETUP.md`
- Deploy Vercel: `docs/DEPLOY_VERCEL.md`
- Auditoría RLS: `docs/RLS_AUDIT.md`
