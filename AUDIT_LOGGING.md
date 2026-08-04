# DrFlow Immutable Audit Logging

**Date:** 2026-08-04  
**Migration:** `055_immutable_audit_logging.sql`  
**App API:** `src/lib/security/audit-log.ts`, `logAudit()` in `src/lib/auth/session.ts`

---

## Summary

Every sensitive action is recorded in **`audit_logs`** (and field-level HC changes in **`clinical_record_audit`**). Records are **append-only**: no UPDATE, DELETE, or TRUNCATE for application roles.

| Field | Column | Source |
|-------|--------|--------|
| **Who** | `user_id` | Authenticated user (`auth.uid()`) |
| **When** | `created_at` / `changed_at` | DB default `now()` |
| **What** | `what` + `action` + `entity_type` | Human label + enum |
| **Old value** | `old_values` (JSONB) | Sanitized snapshot before change |
| **New value** | `new_values` (JSONB) | Sanitized snapshot after change |
| **Module** | `module` | Functional area (`clinical`, `patients`, `cash`, …) |
| **Patient** | `patient_id` | Direct or derived from entity |
| **Organization** | `clinic_id` | Tenant / consultorio |
| **IP** | `ip_address` | `x-forwarded-for` / `x-real-ip` when available |
| **User Agent** | `user_agent` | Request header when available |

---

## Database enforcement

### Immutability triggers (048 + 055)

```sql
BEFORE UPDATE OR DELETE ON audit_logs → RAISE EXCEPTION
BEFORE UPDATE OR DELETE ON clinical_record_audit → RAISE EXCEPTION
```

### TRUNCATE blocked (055)

```sql
REVOKE TRUNCATE ON audit_logs FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON clinical_record_audit FROM PUBLIC, anon, authenticated;
```

### RLS INSERT (053)

- `user_id = auth.uid()`
- `clinic_id IN user_clinic_ids()` (or superadmin)

### User deletion (055)

`cleanup_user_profile_references` **no longer mutates** audit tables — actor IDs are preserved for traceability even after account deletion.

---

## Application usage

### Standard audit event

```typescript
import { logAudit } from "@/lib/auth/session";

await logAudit({
  clinicId,
  module: "patients",           // optional — auto-derived from entityType
  what: "Actualizó ficha del paciente",  // optional — auto-generated
  entityType: "patient",
  entityId: patientId,
  patientId,
  action: "update",
  oldValues: before,
  newValues: after,
});
```

### Field-level diff helper

```typescript
import { auditFieldChanges } from "@/lib/security/audit-log";

const { oldValues, newValues } = auditFieldChanges(before, after, [
  "phone",
  "insurance_provider",
]);
```

### Clinical record audit (SOAP)

```typescript
import { buildClinicalRecordAuditRow } from "@/lib/security/audit-log";

await supabase.from("clinical_record_audit").insert(
  buildClinicalRecordAuditRow({
    clinicalRecordId,
    clinicId,
    patientId,
    action: "update",
    what: "Modificó consulta clínica (SOAP)",
    changedBy: user.id,
    oldValues,
    newValues,
    ipAddress: ctx.ip_address,
    userAgent: ctx.user_agent,
  })
);
```

---

## Modules

| Module | Typical entities |
|--------|------------------|
| `clinical` | `clinical_record` |
| `patients` | `patient` |
| `appointments` | `appointment` |
| `prescriptions` | `prescription`, `prescription_draft` |
| `orders` | `medical_order` |
| `cash` | `cash_charge`, `patient_ledger`, closures |
| `admin_docs` | `patient_admin_document` |
| `attachments` | `patient_attachment` |
| `compliance` | ARCO export, consent |
| `auth` | login, registration |
| `imports` | HCE / PDF / batch |
| `system` | fallback |

---

## PHI in snapshots

`sanitizeAuditSnapshot()` truncates long PHI fields (`evolution`, `medical_history`, etc.) before persistence. Full clinical content remains in clinical tables; audit stores enough for traceability without duplicating entire charts.

---

## UI

Patient workspace → **Auditoría** tab (`PatientClinicalAuditPanel`):

- Module badge + human `what` label
- Actor, timestamp, IP, user agent
- Old → new field diff (up to 6 fields)

---

## Apply migration

```bash
supabase db push
# or run supabase/migrations/055_immutable_audit_logging.sql in SQL Editor
```

---

## Related

- [SECURITY_REPORT.md](./SECURITY_REPORT.md) — RLS audit policies
- [DATABASE_REPORT.md](./DATABASE_REPORT.md) — indexes on `audit_logs`
- Migration `048_audit_phase12.sql` — initial immutability + patient scope
