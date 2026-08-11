# BI por especialidad / cobertura — Fase 4D

Panel de **business intelligence** operativo: desglose de atenciones por obra social, especialidad, sede y cruce especialidad×cobertura.

## Ruta

`/reportes/bi` — permiso `viewReports`

También accesible desde **Reportes operativos** → botón *BI especialidad / cobertura*.

## Períodos

| Tab | Alcance |
|-----|---------|
| Hoy | Día calendario (timezone clínica) |
| Semana | Lunes a domingo |
| Mes | Mes calendario actual |

## Métricas

- **Atenciones** (`status = attended`)
- **Tasa de asistencia** = atendidos / turnos programados en el período
- Distribución **% por cobertura** (paciente `insurance_provider`)
- Distribución **% por especialidad** (turno o profesional)
- **Cruce** especialidad × cobertura (top combinaciones)
- **Por sede** (`location_id` → `locations.name`)

## Backend

RPC `summarize_clinic_bi(p_clinic_id, p_start, p_end)` — migración `105_bi_specialty_coverage.sql`.

## Export

CSV multi-sección vía botón *Exportar CSV* (mismas tablas que la UI).

## Relación con otros módulos

| Módulo | Diferencia |
|--------|------------|
| `/atenciones` | Listado paginado + resumen simple por cobertura |
| `/reportes` | KPIs mensuales operativos (turnos, ingresos mock) |
| `/reportes/bi` | BI desglosado especialidad/cobertura/sede |
| Liquidación OS (4B) | Montos a facturar, no volumen clínico |

## Migración prod

`supabase/migrations/105_bi_specialty_coverage.sql`

## QA manual

1. Marcar varios turnos como **Atendido** con distintas coberturas y especialidades
2. Abrir `/reportes/bi?period=monthly`
3. Verificar barras por cobertura/especialidad y export CSV

## Tests

`tests/bi-report.test.ts`
