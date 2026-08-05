# Informe de Auditoría — Operaciones Críticas y Trazabilidad

**Fecha:** 2026-08-04  
**Alcance:** Server Actions, mutaciones clínicas/administrativas, `audit_logs`, `clinical_record_audit`  
**Estado post-refactor:** servicio centralizado + cobertura ampliada; tests ✅

---

## Resumen ejecutivo

| Métrica | Pre-audit | Post-audit |
|---------|-----------|------------|
| Módulo central de auditoría | Parcial (`logAudit` en session) | **`recordAudit` / `recordAuditChange`** |
| Campos por evento | user, IP, UA, action, entity, metadata | + **old/new values** vía `recordAuditChange` |
| Operaciones críticas sin audit | **~25** | **~8** (ver residual) |
| Tabla `audit_logs` | INSERT-only (055) | Sin cambio — inmutable |
| Riesgo trazabilidad | **Medio** | **Bajo** |

---

## Sistema centralizado

### `src/core/security/audit-service.ts`

| Función | Propósito |
|---------|-----------|
| `recordAudit(params)` | Escribe en `audit_logs`: usuario, módulo, qué, entidad, metadata, old/new, **IP**, **user-agent** |
| `recordAuditChange(params)` | Calcula diffs con `auditFieldChanges()` y delega a `recordAudit` |

### Campos persistidos (`buildAuditLogRow`)

| Campo DB | Origen |
|----------|--------|
| `user_id` | Sesión Supabase (o override explícito) |
| `created_at` | Default DB (timestamp inmutable) |
| `clinic_id` | Tenant activo |
| `module` | Clínico, settings, cash, imports, etc. |
| `what` | Descripción legible auto o explícita |
| `entity_type` / `entity_id` | Recurso afectado |
| `patient_id` | Paciente relacionado (si aplica) |
| `action` | create / update / delete / export / … |
| `old_values` / `new_values` | JSON sanitizado (`sanitizeAuditSnapshot`) |
| `ip_address` | `x-forwarded-for` / `x-real-ip` |
| `user_agent` | Header User-Agent |
| `metadata` | Contexto adicional |

### Compatibilidad

`logAudit()` en `session.ts` ahora delega a `recordAudit()` — **sin cambiar firmas** de los ~25 consumidores existentes.

---

## Inventario — operaciones críticas

### Ya auditadas (pre-existente)

| Área | Operaciones | Mecanismo |
|------|-------------|-----------|
| Pacientes | create, update, soft-delete | `logAudit` |
| Historia clínica | create/update record + `clinical_record_audit` | `logAudit` + fila dedicada |
| Turnos | create, update, status | `logAudit` |
| Caja | cargos, anulaciones, cierre | `logAudit` |
| Adjuntos / admin docs | upload, delete | `logAudit` |
| Imports batch | HCE, consumers, PDF jobs | `logAudit` en processors |
| Compliance | ARCO export, legal acceptance | `logAudit` |
| Plugins / flags | update | `logAudit` |
| Auth clínica | setup parcial | `logAudit` |
| Reset clínico | purge historial | `logAudit` |

### Auditadas en este refactor (nuevas)

| Módulo | Operaciones |
|--------|-------------|
| **Equipo** (`invitations.ts`) | invite, revoke, change role, deactivate, remove |
| **Cuenta** (`account.ts`) | deleteMyAccount |
| **Órdenes médicas** | create, void (+ old/new status) |
| **Recetas** | issue, void |
| **Coberturas** | update (+ diff coverages/default) |
| **Settings** | updateClinicSettings (+ diff campos clínica) |
| **Turnos** | startConsultation, finalizeConsultation |
| **Servicios clínica** | sendReminder, telemedicine, mock payment |
| **Indicadores paciente** | savePatientClinicalIndicators |
| **Perfil médico** | updateMyDoctorProfile |
| **Demo data** | seedDemoPatients |
| **Imports directos** | hce-import, patient-import (sync path) |

---

## Gaps residuales (bajo / documentado)

| Operación | Motivo |
|-----------|--------|
| `public-booking` submit/cancel | Sin sesión autenticada — RLS exige `user_id = auth.uid()` |
| `acceptPendingInvitations` | RPC automático post-login |
| Settings CRUD menor (specialty, location, …) | Baja criticidad; mismo patrón `recordAudit` aplicable |
| `professional-intake.ts` | Onboarding público / semi-público |
| `pharmacology.ts` | Solo lectura |
| Lecturas / GET / signed URLs | Fuera de alcance (no mutación) |

**Nota portal público:** auditar reservas anónimas requeriría policy RPC dedicada o audit table con `user_id` nullable — fuera de alcance para no alterar RLS.

---

## Seguridad e integridad

| Control | Estado |
|---------|--------|
| `audit_logs` INSERT-only trigger (055) | ✅ |
| TRUNCATE revocado | ✅ |
| INSERT policy: `user_id = auth.uid()` + tenant | ✅ (053) |
| PHI en snapshots sanitizado | ✅ `sanitizeAuditSnapshot` |
| Fail-open: audit error no bloquea mutación | ✅ try/catch + console.error |

---

## Archivos modificados

- `src/core/security/audit-service.ts` *(nuevo)*
- `src/core/security/audit.ts` — re-exports
- `src/core/security/audit-log.ts` — entity map (invitation, member)
- `src/core/auth/session.ts` — delegación
- `invitations.ts`, `account.ts`, `medical-orders.ts`, `prescriptions.ts`
- `coverages.ts`, `settings.ts`, `appointments.ts`, `clinic-services.ts`
- `patient-chart-indicators.ts`, `doctor-profile.ts`, `demo-data.ts`
- `hce-import.ts`, `patient-import.ts`
- `tests/audit-critical-operations.test.ts`

---

## Verificación

```bash
npm run test -- tests/audit-critical-operations.test.ts tests/audit-immutable.test.ts
```

---

## Conclusión

Las operaciones críticas de seguridad (equipo, cuenta, recetas, órdenes, coberturas, consultorio) quedan trazadas en **`audit_logs`** con usuario, timestamp, IP, acción, recurso y diffs cuando aplica. El comportamiento funcional de la aplicación no cambia; solo se añaden escrituras de auditoría fire-and-forget.
