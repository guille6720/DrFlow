# DrFlow — Auditoría de Operaciones Atómicas

**Fecha:** 2026-08-04  
**Migración:** `063_atomic_operations.sql`  
**Principio:** Toda operación multi-tabla crítica debe ejecutarse en **una transacción PostgreSQL** (RPC SECURITY DEFINER).

---

## Resumen

| Antes | Después |
|-------|---------|
| ~25 flujos multi-tabla vía múltiples calls PostgREST | 10 RPCs atómicos + refactor TS |
| Fallo parcial sin rollback en caja, HC, pacientes, booking | Error en cualquier paso → **ROLLBACK implícito** |
| Audit log separado (best-effort) | Sin cambio — audit post-RPC, no bloquea negocio |

---

## Patrón adoptado

```
App (Server Action)
  └─ supabase.rpc('operation_atomic', {...})   ← 1 round-trip
       └─ PostgreSQL function (implicit BEGIN…COMMIT)
            ├─ INSERT/UPDATE tabla A
            ├─ INSERT/UPDATE tabla B
            └─ RAISE EXCEPTION → rollback total
```

PostgREST **no soporta** transacciones multi-statement desde el cliente JS. La solución canónica en Supabase es RPC.

---

## RPCs creados (063)

| RPC | Tablas | Refactor TS |
|-----|--------|-------------|
| `submit_public_booking` (+ consent) | patients, appointments, consent_records | `public-booking.ts` |
| `update_waiting_room_status_atomic` | appointments (status + waiting_room) | `waiting-room.ts` |
| `create_telemedicine_session_atomic` | telemedicine_sessions, appointments | `clinic-services.ts` |
| `create_clinical_record_atomic` | clinical_records, appointments?, clinical_record_audit | `clinical-records.service.ts` |
| `update_clinical_record_atomic` | clinical_records, clinical_record_audit | `clinical-records.service.ts` |
| `create_patient_with_clinical_profile` | patients, patient_clinical_profiles | `patients.service.ts` |
| `update_patient_with_clinical_profile` | patients, patient_clinical_profiles | `patients.service.ts` |
| `accept_clinic_invitation_for_existing_user` | clinic_members, clinic_invitations | `invitations.ts` |
| `create_cash_charge_atomic` | cash_charges, patient_ledger_entries | `cash-register.ts` |
| `void_cash_charge_atomic` | cash_charges, patient_ledger_entries | `cash-register.ts` |
| `add_patient_ledger_entry_atomic` | patient_ledger_entries | `cash-register.ts` |

\* Caja requiere migración **034** — RPC retorna `CAJA_MODULE_NOT_INSTALLED` si falta.

---

## Mejoras de concurrencia

Los RPCs de ledger usan `SELECT … FOR UPDATE` sobre el último saldo antes de insertar — evita balances inconsistentes bajo carga concurrente (mejora vs. código anterior).

---

## Flujos ya atómicos (sin cambio)

| RPC existente | Uso |
|---------------|-----|
| `setup_user_clinic` | Onboarding clínica |
| `delete_own_account` | Borrado cuenta |
| `remove_clinic_member_user` | Eliminar miembro |
| `accept_clinic_invitations_for_user` | Aceptar invitaciones |
| `cancel_patient_appointment` | Cancel portal |
| `seed_demo_patients_for_clinic` | Demo data |

---

## Flujos intencionalmente no atómicos

| Flujo | Motivo |
|-------|--------|
| **Imports batch** (CSV, HCE, JSONL) | Diseño: continuar fila a fila; errores parciales reportados |
| **Storage + DB uploads** | Compensación manual (delete storage si falla DB) — transacción cross-system imposible |
| **Telemedicina room externo** | API externa antes del RPC; si RPC falla, room huérfano (mismo riesgo previo) |
| **Audit log (`recordAudit`)** | Observabilidad best-effort post-commit |
| **Auth invite email** | Supabase Auth API + DB invitation — sistemas separados |
| **Clinical reset / purge** | Operación admin destructiva; compensación manual documentada |

---

## Verificación

```bash
npm run test -- tests/atomic-operations-migration.test.ts
```

Despliegue: aplicar **063** después de 062 en Supabase SQL Editor.

---

## Backlog P3

1. RPC `professional_intake_atomic` (specialty + location + professional + rules)
2. RPC `send_reminder_atomic` (reminder_log + clinic_job)
3. Import batch con SAVEPOINT por fila (rollback parcial controlado)
4. Mover purge pre-delete a RPC dentro de `delete_own_account`
