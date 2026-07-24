# Auditoría RLS — DrFlow (P0)

**Fecha de referencia:** post-migración `032_clinic_trial.sql`  
**Modelo:** multi-tenant por `clinic_id` + helpers `user_clinic_ids()`, `can_view_clinical()`, etc.

---

## Resumen

| Área | Estado | Notas |
|------|--------|--------|
| Tablas clínicas core | OK | RLS en `002_rls_policies.sql` + extensiones 004–028 |
| Helpers SECURITY DEFINER | OK | Acotados a `auth.uid()` / membresía |
| RPC públicas (`anon`) | Revisar | Booking y status paciente — diseño intencional |
| Storage `clinical-files` | OK | Políticas en `028_clinical_files_storage.sql` |
| App layer | Complemento | Server Actions deben filtrar por clínica activa; RLS es última línea |

**Riesgo residual principal:** funciones `SECURITY DEFINER` mal validadas o service role en app bypass RLS. Mantener checklist en cada RPC nueva.

---

## Tablas con RLS obligatorio

Ver manifest en `tests/rls-policies.test.ts` (lista verificada en CI). Incluye:

- Núcleo: `clinics`, `profiles`, `clinic_members`, `patients`, `appointments`, `clinical_records`, …
- Extensiones: `medical_orders`, `clinic_invitations`, `patient_app_share_log`, farmacología (`pathologies`, `drugs`, …)

Tablas de referencia farmacológica: lectura solo con rol clínico (`005` / `011`).

---

## Políticas críticas (multi-tenant)

| Recurso | Aislamiento |
|---------|-------------|
| `patients`, `appointments` | `clinic_id IN user_clinic_ids()` (+ portal paciente vía `user_id`) |
| `clinical_records` | `can_view_clinical(clinic_id)` — secretaría/doctor/admin |
| `prescription_drafts` | Mismo criterio clínico |
| `audit_logs` | SELECT por clínica del usuario; INSERT autenticado |
| `clinics` | SELECT membresía; UPDATE solo `clinic_admin` |

**Superadmin:** bypass vía `is_superadmin()` en helpers — coherente con panel SaaS.

---

## RPC `SECURITY DEFINER` (checklist)

Toda función con elevación de privilegios debe:

1. Fijar `SET search_path = public`
2. Validar `auth.uid()` cuando la operación es de usuario autenticado
3. Acotar por `clinic_id` / slug / membresía antes de leer o escribir filas clínicas

| Función | Migración | Validación tenant |
|---------|-----------|-------------------|
| `setup_user_clinic` | 024 | `auth.uid()`, una clínica por usuario |
| `seed_pami_cabecera_for_clinic` | 030 | Membresía activa o superadmin |
| `submit_public_booking` | 010+ | Slug / link público activo |
| `get_patient_appointment_statuses` | 022 | slug + DNI + IDs de turnos |
| `search_pathologies` / síntomas | 011 | Rol clínico en grants |
| `seed_demo_patients_for_clinic` | 019 | Admin clínica o superadmin |

Migraciones **030** y **031**:

- **030:** columna `accepted_coverages` + RPC PAMI reforzado con `FORBIDDEN` sin membresía.
- **031:** trigger `handle_new_user` — solo perfiles; sin exposición cross-tenant.

---

## Tests automatizados

| Test | Qué valida |
|------|------------|
| `tests/rls-policies.test.ts` | RLS habilitado en tablas del manifest; RPC DEFINER con señales de control |
| `tests/cross-tenant-rls.integration.test.ts` | Opcional: `DRFLOW_RLS_INTEGRATION=1` + service role |

Integración local (dos clínicas reales):

```powershell
$env:DRFLOW_RLS_INTEGRATION="1"
# Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm run test:rls
```

---

## Aplicar migraciones 030–032 en producción

Ver **`docs/MIGRATIONS.md`**. Orden:

1. `030_clinic_accepted_coverages.sql`
2. `031_google_profile_name.sql`
3. `032_clinic_trial.sql`

Verificación:

```powershell
npm run check:supabase
node scripts/check-coverages-column.mjs
```

---

## Recomendaciones P1 (fuera de este P0)

- Ejecutar `cross_tenant_rls.sql` tras cada cambio mayor de RLS (manual en SQL Editor).
- Tipos generados desde Supabase en CI.
- Rate limit en RPC públicas expuestas a `anon`.
