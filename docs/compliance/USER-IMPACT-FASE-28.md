# Impacto en usuarios existentes — Fase 28

> Antes de declarar cierre del trabajo de compliance/monetización.  
> Niveles: **LOW / MEDIUM / HIGH**. No es asesoramiento legal.

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

Catálogo: `src/core/compliance/user-impact.ts`

---

## Resumen

| Categoría | Nivel |
|-----------|-------|
| Database | **MEDIUM** |
| Authentication | **LOW** |
| Clinic | **MEDIUM** |
| Patient data | **MEDIUM** |
| Subscription | **HIGH** |
| UI | **MEDIUM** |
| API | **MEDIUM** |

**Overall:** **HIGH** (por suscripciones). El resto es mayormente endurecimiento y features opt-in/administrativas.

---

## Database — MEDIUM

Migraciones 132–137: columnas/tablas/funciones/RLS/storage. **No** wipe de clínicas, perfiles ni HC.

Efectos: gate API pública, consentimientos con retiro, cola ARCO, bucket privado, `canceled` paid-through.

Mitigación: verify staging OK; rollbacks documentados.

---

## Authentication — LOW

Sin cambio de IdP. Rate-limit/CSRF en auth reducen abuso; login normal no debería degradarse.

---

## Clinic — MEDIUM

Nuevas capacidades en Configuración (cancelación, ARCO, consentimientos). Integradores con `clinic_id` incorrecto reciben FORBIDDEN. Investigación clínica oculta por default.

---

## Patient data — MEDIUM

Exports con TTL; storage path-aware; sin hard-delete de HC por ARCO; IA puede bloquear envíos; recetas como borrador local.

**No** implica destrucción masiva de datos de pacientes existentes.

---

## Subscription — HIGH

- Monto debe coincidir con catálogo o no activa plan.  
- Cancelación self-serve (acceso hasta vencimiento).  
- Refund/chargeback → `past_due`.  
- MP ≠ factura fiscal.

**Comunicar** a clientes de pago antes/después del deploy.

---

## UI — MEDIUM

Botón cancelar, paneles privacy/compliance, labels de receta, protocolos de investigación ocultos. Sin rediseño global de agenda/HC.

---

## API — MEDIUM

Tenant gate en RPCs públicas, webhook HMAC, CSRF en checkout, headers/rate-limit/SSRF. Clientes bien configurados del propio tenant: impacto bajo; mal configurados: fallos cerrados.

---

## Recomendaciones operativas

1. Aviso a clínicas con suscripción activa sobre cancelación y reglas de monto.  
2. Revisar integradores API pública post-133.  
3. No activar `clinical_research_protocols` sin revisión legal.  
4. Mantener secret MP webhook en staging/prod.

---

## Veredicto

**OK para documentar cierre técnico con impacto HIGH en suscripciones.**  
Usuarios existentes de HC/agenda: impacto moderado (seguridad). Usuarios de billing: impacto alto — planificar comunicación.

*No certifica ausencia total de fricción para todos los tenants.*
