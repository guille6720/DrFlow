# Fase 12 — Derechos de privacidad (ARCO / habeas data)

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**

## Objetivo (PHASE 12)

Verificar mecanismos para atender pedidos legítimos de datos personales, con flujo administrativo de:

| Derecho | Soporte en producto |
|---------|---------------------|
| Acceso | Export Habeas Data + pedido `access` |
| Rectificación | Pedido `correction` + edición de ficha |
| Exportación | `exportPatientArcoBundle` + pedido `export` |
| Supresión / bloqueo | Pedido `deletion` / `blocking` con **advertencia de retención** |

**Regla dura:** no permitir borrado automático que viole retención de HC.

## Distinción crítica

| Privacidad (Ley 25.326) | Retención clínica (Ley 26.529) |
|-------------------------|--------------------------------|
| Acceso, rectificación, oposición, exportación | Conservar HC el mínimo configurable |
| Baja lógica / bloqueo de uso | No hard-delete de HC / recetas / auditoría |

## Qué se implementó

1. Migración **`135_privacy_rights_requests.sql`** — cola administrativa + RLS + gate de ack
2. Módulo **`src/core/compliance/privacy-rights.ts`**
3. Actions **`src/lib/actions/privacy-rights.ts`**
4. UI **Configuración → Cumplimiento** — `PrivacyRightsPanel`
5. Advertencias internas al cumplir deletion/blocking

## Verificación

```bash
npx vitest run tests/privacy-rights-fase12.test.ts
npx tsc --noEmit
```

Aplicar migración **135** en staging.

## Límites / no afirmar

- El flujo es **administrativo** (registro y seguimiento), no un portal del titular.
- Cumplir un pedido de “borrado” no ejecuta destrucción de HC.
- Esta fase **no certifica** cumplimiento AAIP por sí sola.

## Veredicto técnico Fase 12

**OK** — Workflow ARCO administrativo con exportación existente y bloqueo explícito de hard-delete clínico automático.
