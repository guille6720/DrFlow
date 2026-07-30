# Secretaría y Caja (DrFlow)

Módulo administrativo independiente de la historia clínica. Migración: `034_secretaria_caja.sql`.

## Rol Secretaría

- **Puede:** agenda, pacientes (solo datos administrativos), sala de espera, caja, documentos admin, reportes.
- **No puede:** historias clínicas, recetas, diagnósticos, evoluciones (RLS + permisos `viewClinicalRecords` / `editClinicalRecords`).

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/sala-espera` | Tablero kanban del día con actualización realtime |
| `/caja` | Registro rápido de cobros |
| `/caja/cierre` | Cierre diario + export PDF/Excel |
| `/caja/reportes` | Filtros por fecha, profesional, medio de pago |
| `/caja/cuenta-corriente` | Movimientos debe/haber por paciente |
| `/secretaria/documentos` | PDF administrativos (autorizaciones, órdenes, estudios) |

## Tablas

- `cash_charges` — cobros
- `patient_ledger_entries` — cuenta corriente
- `cash_daily_closures` — cierres
- `cash_invoices` — preparado AFIP/ARCA (CAE, comprobante)
- `patient_admin_documents` — documentación no clínica
- `cash_charge_types` / `cash_payment_methods` — catálogos

## Permisos (app)

- `manageCashRegister` — admin, secretaría, médico (si `clinics.doctors_can_access_cash`)
- `manageWaitingRoom` — admin, secretaría, médico
- `manageAdminDocuments` — admin, secretaría

## Auditoría

Acciones críticas registradas en `audit_logs`: cobros, anulaciones, cierres, documentos, sala de espera.

## Despliegue

1. Aplicar migración `034_secretaria_caja.sql` en Supabase.
2. (Opcional) Habilitar Realtime en tabla `appointments` para sala de espera instantánea.
