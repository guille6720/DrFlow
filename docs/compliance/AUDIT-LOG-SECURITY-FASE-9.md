# Fase 9 — Seguridad de registros de auditoría

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**

## Objetivo (PHASE 9)

Verificar y reforzar que los usuarios normales del consultorio **no pueden alterar** la auditoría (UPDATE/DELETE, autoría, timestamps) y que las **operaciones sensibles** quedan registradas.

## Controles técnicos

| Control | Implementación |
|---------|----------------|
| Inmutabilidad | Triggers `prevent_audit_mutation` (048/055) |
| Sin UPDATE/DELETE app | Sin políticas RLS de mutación + `REVOKE` (132) |
| Autoría `audit_logs` | RLS `user_id = auth.uid()` (053) |
| Autoría `clinical_record_audit` | RLS `changed_by = auth.uid()` + `can_write_clinical` (132) |
| Timestamps | Trigger `enforce_audit_insert_integrity` — `now()` en INSERT (132) |
| TRUNCATE bloqueado | REVOKE (055) |

Fuente única de política: `src/core/compliance/audit-log-security.ts` → `AUDIT_LOG_SECURITY_POLICY`.

## Operaciones sensibles registradas

| Categoría | Canal | Señales en app |
|-----------|-------|----------------|
| Consulta HC / workspace | `audit_logs` | `recordSensitiveAccess` |
| Detalle de consulta | `audit_logs` + `clinical_record_audit` | loaders HC + RPC atómico |
| Descarga adjuntos | `audit_logs` | `getPatientClinicalDocumentUrl`, `getAdminDocumentUrl` |
| Creación / edición HC | `clinical_record_audit` | RPC + helpers integridad |
| Exportaciones ARCO | `audit_logs` | compliance + integraciones |
| Recetas / órdenes | `audit_logs` | acciones recetas |
| Permisos / invitaciones | `audit_logs` | invitations, team-permissions |
| IA clínica | `audit_logs` | `recordAiAuditEvent` (sin prompts) |
| Config / retención | `audit_logs` | settings, data-retention |

## Qué se reforzó en Fase 9

1. Migración **`132_audit_log_security.sql`** — timestamps server-owned, RLS authorship HC, REVOKE UPDATE/DELETE
2. Módulo **`audit-log-security.ts`** — matriz centralizada + `evaluateAuditLogSecurityPosture`
3. **Auditoría de descargas** — URL firmada de adjuntos clínicos y documentos admin
4. Tests **`tests/audit-log-security-fase9.test.ts`**

## Verificación

```bash
npx vitest run tests/audit-log-security-fase9.test.ts tests/audit-immutable.test.ts tests/audit-critical-operations.test.ts
npx tsc --noEmit
```

## Límites / no afirmar

- Si falla el INSERT de auditoría, la mutación principal puede completarse (non-blocking — ver Fase 1).
- Usuarios con `can_view_clinical` leen `audit_logs` del tenant (048) — decisión de producto.
- SECURITY DEFINER RPCs insertan auditoría HC sin pasar por RLS de cliente (correcto).
- Esta fase **no certifica** cumplimiento AAIP ni Ley 26.529 por sí sola.

## Veredicto técnico Fase 9

**OK** — Auditoría inmutable, autoría acotada, timestamps del servidor, cobertura de operaciones sensibles verificada por tests.
