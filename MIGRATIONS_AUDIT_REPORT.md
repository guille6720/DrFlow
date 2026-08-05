# DrFlow — Auditoría de Migraciones SQL

**Fecha:** 2026-08-04  
**Alcance:** 64 archivos en `supabase/migrations/` (001 → 062, más 004b y 005b)  
**Correcciones aplicadas:** 004, 014, 016, 023, 034, 041, 045

---

## Resumen ejecutivo

| Criterio | Estado | Notas |
|----------|--------|-------|
| **Orden cronológico** | ✅ OK | Lexicográfico correcto; sufijos `b` en 004b/005b |
| **Dependencias** | ✅ OK en secuencia completa | Fresh `db reset` 001→062 funciona |
| **Idempotencia** | ⚠️ Mejorada | 034/004/023 corregidos; 001/002 siguen one-shot |
| **Compatibilidad hacia atrás** | ✅ OK | Sin DROP destructivo; repairs NULL-only |
| **Duplicadas** | ⚠️ 6 repair docs | 014≡013, 016≡015, 041≡034 — marcadas OBSOLETA |
| **Obsoletas** | ℹ️ 035–040 | Supersedidas por 055; mantener por historial |

---

## Inventario cronológico (64 archivos)

| # | Archivo | Propósito |
|---|---------|-----------|
| 001 | `001_schema.sql` | Schema MVP base |
| 002 | `002_rls_policies.sql` | RLS inicial |
| 003 | `003_seed.sql` | Seed demo clínica |
| 004 | `004_demo_professionals_and_public_booking.sql` | Demo + portal anon |
| 004b | `004b_fix_appointment_status_cast.sql` | Repair cast demo |
| 005 | `005_pharmacology_reference.sql` | Farmacología ref |
| 005b | `005b_pharmacology_seed_only.sql` | Repair seed farmacología |
| 006–011 | Perfiles, setup, síntomas | Policies + RPC setup |
| 012 | `012_pharmacology_common_symptoms.sql` | Seed + search upgrade |
| 013 | `013_electronic_prescriptions_argentina.sql` | Recetas AR |
| 014 | `014_repair_prescription_schema.sql` | **OBSOLETA** — repair 013 |
| 015 | `015_drapp_inspired_features.sql` | medical_orders + booking |
| 016 | `016_fix_015_booking_rpc.sql` | **OBSOLETA** — repair 015 |
| 017–033 | Demo, PAMI, legal, trial | Features incrementales |
| 034 | `034_secretaria_caja.sql` | **Módulo caja** — idempotente tras fix |
| 035–040 | Auth cleanup chain | Evolución delete cuenta |
| 041 | `041_patients_insurance_plan.sql` | **REDUNDANTE** con 034 |
| 042–044 | Vademecum, voz, intake | Extensiones |
| 045 | `045_security_hardening.sql` | Security + indexes (sin dup) |
| 046–047 | Performance + PHI split | Índices + patient_clinical_profiles |
| 048–055 | Audit + immutability | Fase 12–17 |
| 056–058 | Flags, parity, RLS audit | Platform hardening |
| 059–062 | Upload, RI, indexes, constraints | Auditorías recientes |

---

## Dependencias críticas

```
001_schema
  └─ 002_rls
       └─ 004+ (booking, demo)
            └─ 013 prescriptions
                 └─ 015 medical_orders
                      └─ 034 caja (opcional en prod actual)
                           └─ 047 PHI split
                                └─ 048 audit
                                     └─ 055 immutability
                                          └─ 057 parity
                                               └─ 060 referential integrity
                                                    └─ 061 indexes
                                                         └─ 062 constraints
```

### Funciones redefinidas (evolución esperada)

| Función | Versiones canónicas | Obsoletas |
|---------|---------------------|-----------|
| `setup_user_clinic` | **057** (9 args + flags) | 008, 009, 024 |
| `cleanup_user_profile_references` | **055** (audit immutable) | 035–039 |
| `delete_own_account` | **040** | 039 |
| `submit_public_booking` | **015/016** | 004, 004b, 010 |
| `prevent_audit_mutation` | **055** | 048 (re-drop/re-add) |

---

## Idempotencia por fase

| Fase | Migraciones | Re-run manual |
|------|-------------|---------------|
| **One-shot** | 001, 002 | ❌ Falla |
| **Repair idempotent** | 004b, 005b, 010, 013–016, 041 | ✅ |
| **Policies fixed** | 004, 023, 034 | ✅ Tras corrección |
| **Fully hardened** | 053–062 | ✅ IF NOT EXISTS / guards |

### Correcciones aplicadas en esta auditoría

| Archivo | Problema | Fix |
|---------|----------|-----|
| **034** | CREATE TYPE/TABLE/INDEX/POLICY sin guards; seed duplicaba | Enums con `duplicate_object`; `IF NOT EXISTS`; `DROP POLICY`; seed `WHERE NOT EXISTS` |
| **004** | 9 policies anon sin DROP | `DROP POLICY IF EXISTS` antes de cada CREATE |
| **023** | Policies sin DROP | Idem |
| **045** | `idx_clinical_records_clinic` duplicaba 054 | Eliminado; 054/061 son dueños |
| **014, 016, 041** | Duplicados sin documentar | Headers OBSOLETA/REDUNDANTE |

---

## Migraciones duplicadas

| Par | Relación | Acción |
|-----|----------|--------|
| 013 ↔ 014 | Idéntico DDL recetas | 014 marcada OBSOLETA; mantener |
| 015 ↔ 016 | Idéntico medical_orders/RPC | 016 marcada OBSOLETA |
| 034 ↔ 041 | `insurance_plan` column | 041 marcada REDUNDANTE |
| 045 ↔ 054 ↔ 061 | Index `(clinic_id, created_at)` clinical_records | 045 eliminado; 061 DROP legacy |
| 056 ↔ 057 | Flag `admin_ops_assistant` | Idempotente; OK |
| 057 ↔ 060 | `professional_id` clinic_members | Defensivo idempotente; OK |

---

## Migraciones obsoletas (mantener, no borrar)

| Rango | Motivo |
|-------|--------|
| **004b, 005b, 010** | Repairs históricos de deploy parcial |
| **014, 016** | Repairs de 013/015 — ya documentados |
| **035–039** | Cadena cleanup auth — lógica final en **055** + **040** |
| **041** | Columna ya en 034 |

> **Regla:** No eliminar migraciones ya aplicadas en prod. Documentar supersession en headers.

---

## Compatibilidad hacia atrás

| Riesgo | Mitigación |
|--------|------------|
| NOT NULL sin backfill | 062 hace UPDATE antes de ALTER |
| DELETE business rows | 060 solo NULL/sync |
| DROP column/table | Ninguno en 053–062 |
| Rename breaking | Ninguno |
| Prod sin 034 (caja) | 061/062 usan `to_regclass` guards |
| Dedup nombres catálogo (062) | Renombra con sufijo UUID — visible en UI |

---

## Seeds mezclados con schema

Recomendación P2 (no bloqueante): mover a `supabase/seed.sql`:

- `003`, `004`, `005`, `011`, `012`, `017`, `019`
- Seeds en `034`, `049`, `050`, `056`

`003_seed.sql` usa `ON CONFLICT DO NOTHING` sin target UNIQUE en `(clinic_id, name)` — puede duplicar specialties en re-run. Mitigar con UNIQUE de 062 en specialties.

---

## Estado producción DrFlow (referencia)

| Migración | Prod |
|-----------|------|
| 057–062 | ✅ Aplicadas |
| **034** (caja) | ❌ Pendiente — aplicar versión corregida |

Tras aplicar **034** corregida, re-ejecutar bloques DO de **061** (ledger/cash indexes).

---

## Verificación

```bash
npm run test -- tests/migrations-consistency.test.ts
```

Post-deploy SQL:

```sql
SELECT * FROM verify_referential_integrity();
SELECT * FROM verify_constraint_integrity();
```

---

## Backlog P3

1. Squash 035–040 en comentarios-only en próximo major baseline
2. Mover demo seeds fuera de migrations/
3. `003_seed.sql` — upsert determinístico con UNIQUE de 062
4. Habilitar `supabase db lint` en CI
5. Documentar orden mínimo prod: 001–033 → 034? → 042+ → 057–062
