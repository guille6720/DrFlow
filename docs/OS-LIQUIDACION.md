# Liquidación obras sociales — Fase 4B

Facturación y liquidación de **reintegros ante obras sociales / prepagas**, separada de la caja (copagos/coseguros cobrados al paciente).

## Flujos de dinero

| Flujo | Módulo | Descripción |
|-------|--------|-------------|
| Copago / coseguro en recepción | **Caja** (`cash_charges`) | Cobro al paciente en el consultorio |
| Reintegro de la OS al consultorio | **Liquidación OS** (4B) | Montos a presentar y acreditar por la prepaga |

## Modelo

| Tabla | Uso |
|-------|-----|
| `os_fee_schedules` | Tarifa de consulta por obra social (código 420101 por defecto) |
| `os_billable_items` | Ítem facturable (desde atención `attended` o pendiente) |
| `os_liquidation_batches` | Lote por OS + período (borrador → presentado → acreditado) |

Estados del lote: `draft` → `submitted` → `paid` (o `cancelled`).

## UI

| Ruta | Función |
|------|---------|
| `/facturacion/tarifas` | CRUD tarifas por OS |
| `/facturacion/liquidacion` | Listado de lotes + resumen pendientes |
| `/facturacion/liquidacion/nueva` | Crear lote (OS + período) |
| `/facturacion/liquidacion/[id]` | Detalle, export CSV, cambiar estado |

Permiso: `manageCashRegister` (mismo que Caja).

Nav: **Administración → Liquidación OS**.

## Creación de lote

RPC `create_os_liquidation_batch`:

1. Busca turnos **atendidos** en el período con cobertura = OS elegida
2. Resuelve importe vía `os_fee_schedules` (omite si tarifa = 0)
3. Suma **copagos** ya cobrados en caja (`cash_charges`, `attention_type = obra_social`)
4. Crea ítems y lote en estado `draft`

Export CSV incluye columnas: fecha, OS, afiliado, plan, práctica, importe, copago, **neto**.

## Migración

- Desarrollo: `supabase/migrations/103_os_liquidacion.sql`
- Producción: si falla `can_manage_cash(uuid) does not exist`, correr primero `supabase/scripts/prod-fix-os-liquidacion.sql` (bootstrap de permisos caja desde migración 034) y luego el bloque RLS o la migración 103 completa.

**Nota:** `create_os_liquidation_batch` usa `cash_charges` para copagos; requiere migración **034** (caja) aplicada en prod.

## QA manual sugerido

1. **Tarifas** — cargar tarifa OSDE $15.000
2. Marcar turnos atendidos con pacientes OSDE en el mes
3. **Nuevo lote** — OSDE, período del mes → ver ítems
4. **Exportar CSV** — verificar neto = importe − copago
5. **Marcar presentado / acreditado**
6. Cobrar copago en caja para un turno OSDE y verificar que aparece en columna copago

## Tests

`tests/os-liquidacion.test.ts` — schemas Zod, CSV export, labels.

## Pendiente (futuro)

- Nomenclador nacional completo / múltiples prácticas por ítem
- Integración portal OS (IOMA, OSDE, etc.)
- Vinculación PAMI planillas → liquidación PAMI
- AFIP / factura electrónica (`cash_invoices`)
