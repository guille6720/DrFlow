# Fase 8 — Retención de historias clínicas

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**

## Objetivo (PHASE 8)

Verificar que DrFlow **soporta conservar** historias clínicas al menos el plazo de retención aplicable, con configuración **centralizada** (sin literales dispersos).

## Supuesto de producto (documentado)

| Parámetro | Valor |
|-----------|--------|
| Default | **10 años** (`CLINICAL_RECORD_RETENTION_YEARS`) |
| Rango configurable | 5–30 años (`clinics.clinical_record_retention_years`) |
| Ancla del reloj HC | **Última consulta clínica** del paciente (`last_clinical_entry`) |
| Purge automático | **No** — DrFlow no destruye HC al vencer el plazo |

Fuente única de política: `src/core/compliance/data-retention-policy.ts` → `CLINICAL_RETENTION_POLICY`.  
Constante legal de producto: `src/core/legal/documents.ts` → `CLINICAL_RECORD_RETENTION_YEARS = 10`.

## Qué ya existía (verificado)

| Pieza | Estado |
|-------|--------|
| Migración `099_data_retention_policy.sql` | ✅ Default 10, check 5–30 |
| Panel Configuración → Cumplimiento | ✅ `retention-policy-panel.tsx` |
| Baja lógica de paciente + ack | ✅ |
| Matriz de categorías | ✅ HC, recetas, auditoría, consentimientos, etc. |
| Jobs de auto-borrado clínico | ✅ **No existen** (solo purge de migración Fase 7 / telemetría) |

## Qué se reforzó en Fase 8

1. **`CLINICAL_RETENTION_POLICY`** — config canónica (años, ancla, `autoPurgeEnabled: false`)
2. Helpers de ancla por **última consulta**: `patientHistoryRetentionUntil`, `isPatientHistoryWithinRetention`, `latestClinicalEntryAt`
3. **`evaluateRetentionPreservationSupport`** — verifica soporte técnico ≥ 10 años default
4. Resumen de clínica ampliado (fecha de fin de retención desde última nota, notas de política)
5. Copy de baja de paciente: conserva HC “desde la última consulta”

## Distinción con Fase 7

| Fase 7 | Fase 8 |
|--------|--------|
| Impedir hard-delete | Asegurar **conservación** por N años |
| Archive / lifecycle | Reloj de retención + config central |
| Purge solo migración | Sin purge automático al vencer plazo |

## Verificación técnica

```bash
npx vitest run tests/data-retention-policy.test.ts
npx tsc --noEmit
```

## Límites / no afirmar

- El valor de 10 años es **supuesto de producto / práctica habitual**; el consultorio puede configurar 5–30. Valores &lt; 10 generan aviso técnico, no bloqueo.
- La destrucción certificada **después** del plazo es decisión operativa/legal externa (no hay job de purge clínico).
- Esta fase **no certifica** cumplimiento AAIP ni Ley 26.529 por sí sola.

## Veredicto técnico Fase 8

**OK** — Retención centralizada, default 10 años desde última consulta, sin auto-purge clínico, UI y DB alineados.
