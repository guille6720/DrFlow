# Cancelación y derechos del consumidor — Fase 21

> Postura técnica de baja de suscripción SaaS.  
> **No constituye asesoramiento legal.** La aplicabilidad de normas de consumo / arrepentimiento:  
> **REQUIERE REVISIÓN LEGAL SEGÚN TIPO DE CLIENTE B2B/B2C**

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

---

## Objetivo

Auditar la cancelación de suscripciones; ofrecer un mecanismo **simple** sin obstáculos innecesarios; evaluar UI para baja del servicio y derecho de retiro/arrepentimiento **sin decidir aplicabilidad legal solo desde el código**.

---

## Evaluación técnica (UI)

| Pregunta | Conclusión técnica |
|----------|-------------------|
| ¿Hace falta UI de cancelación del servicio? | **Sí** — implementada en Configuración → Plan |
| ¿Hace falta UI específica de derecho de arrepentimiento? | **Parcial** — aviso + marcador legal; no se afirma que aplique a todos los clientes |
| ¿Se puede decidir B2B vs B2C desde el código? | **No** — **REQUIERE REVISIÓN LEGAL SEGÚN TIPO DE CLIENTE B2B/B2C** |

---

## Controles implementados

| Control | Estado | Dónde |
|---------|--------|--------|
| Cancelación self-serve | ✅ | `CancelSubscriptionButton` + `cancelClinicSubscriptionAction` |
| Una sola confirmación | ✅ | Sin encuesta / teléfono / retención multi-paso |
| Acceso hasta fin de período pagado | ✅ | `subscriptionGrantsAccess` + migración `137` |
| Audit de baja | ✅ | `audit_logs` con `source: self_serve_cancel` |
| Accesos manuales | ✅ | No self-serve (derivar a ventas) |
| Preapproval MP | parcial | Checkout Pro por cobro; cancel remoto MP si hay preapproval futuro |

Módulo: `src/core/compliance/cancellation-consumer-rights.ts`  
Migración: `supabase/migrations/137_subscription_cancellation.sql`

---

## Flujo

1. Usuario con `manageSettings` abre Configuración → Plan.  
2. Clic en **Cancelar suscripción** → una confirmación → server action.  
3. Estado → `canceled`, `canceled_at` ahora.  
4. Si `current_period_end` es futuro, el acceso continúa hasta esa fecha (app + `clinic_subscription_active`).  
5. No se inventa reembolso automático (ver Fase 19/20).

---

## Marcador legal obligatorio

```
REQUIERE REVISIÓN LEGAL SEGÚN TIPO DE CLIENTE B2B/B2C
```

Incluye (sin afirmar aplicabilidad): derecho de arrepentimiento, Ley de Defensa del Consumidor, términos B2B, plazos y canales de ejercicio.

---

## Tests

`tests/cancellation-consumer-rights-fase21.test.ts`

---

## Veredicto técnico

**OK** — Hay mecanismo simple de cancelación sin obstáculos innecesarios; acceso paid-through documentado. La calificación jurídica B2B/B2C y el derecho de arrepentimiento quedan como **revisión legal externa**.

*No afirma cumplimiento de normas de consumo.*
