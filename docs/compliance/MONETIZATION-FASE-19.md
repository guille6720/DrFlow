# Monetización — Fase 19 (seguridad de pagos y planes)

> Postura técnica de monetización SaaS (Mercado Pago + entitlements).  
> **No constituye asesoramiento legal ni certificación de cumplimiento fiscal.**

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

---

## Objetivo

Auditar e endurecer: planes, suscripciones, entitlements, Mercado Pago, webhooks, cancelación, pagos fallidos, reembolsos y cambios de plan — de modo que **el cliente no pueda forjar estado de pago** para obtener un plan pago.

---

## Controles implementados

| Control | Estado | Dónde |
|---------|--------|--------|
| Autenticidad webhook (HMAC) | ✅ | `verifyMercadoPagoWebhookSignature` |
| Secret obligatorio en producción | ✅ | HTTP 503 si falta `MP_WEBHOOK_SECRET` |
| Idempotencia por `payment_id` | ✅ | UNIQUE en `clinic_subscription_payments` |
| Fuente de verdad = API MP | ✅ | `fetchMercadoPagoPayment` (no confiar solo en body) |
| Monto vs catálogo server-side | ✅ | `assertApprovedPaymentMatchesCatalog` |
| Checkout con `clinicId` de sesión | ✅ | `create-preference` + CSRF |
| Entitlements no forgeables | ✅ | RPC `assign_clinic_entitlement_plan` (superadmin/service_role) |
| RLS suscripciones solo SELECT | ✅ | Migración `100_clinic_subscriptions.sql` |

Módulo de postura: `src/core/compliance/monetization-security.ts`.

---

## Ciclo de vida (honestidad)

| Capacidad | Estado | Notas |
|-----------|--------|--------|
| Catálogo / checkout | implementado | Precios en `plans.ts` |
| Activación por pago aprobado | implementado | Webhook + monto + entitlement |
| Pagos fallidos / pending | parcial | No activan plan; `past_due` manual/comercial |
| Cancelación self-serve | parcial | Modelo `canceled`; Preapproval formal pendiente |
| Reembolsos / chargebacks | parcial | Webhook → `past_due` si el pago ya estaba registrado |
| Cambio de plan | parcial | Nuevo checkout + upsert; prorrateo formal pendiente |
| Facturación ARCA | externo | Comprobante MP ≠ factura fiscal |

---

## Flujo seguro (resumen)

1. Usuario autenticado (settings) inicia checkout → preference con `external_reference = clinicId:planId:cycle` y monto del **catálogo server**.
2. MP notifica webhook → se verifica HMAC → se **refetch** el pago en API MP.
3. Solo `approved` activa: valida monto/moneda vs catálogo → upsert suscripción → insert pago idempotente → `assign_clinic_entitlement_plan`.
4. `refunded` / `charged_back` sobre pago conocido → marca suscripción `past_due` (no otorga privilegios).
5. Cualquier otro status → skip (sin activar).

---

## Tests

- `tests/monetization-security-fase19.test.ts`
- Existentes: `tests/mercadopago-billing.test.ts`, suite entitlements, `docs/compliance/MONETIZATION-GATE.md`

---

## Remediaciones de esta fase

1. Validación **monto vs catálogo** en `processApprovedMercadoPagoPayment` (gap P1 cerrado).
2. Manejo parcial de **refund/chargeback** → `past_due`.
3. Módulo de política + documentación + tests estáticos.

---

## Veredicto técnico

**OK** — No se puede activar plan pago forjando estado en el frontend; webhook autentica, es idempotente y exige monto de catálogo. Cancelación self-serve, prorrateo y ARCA siguen siendo gaps operativos/externos (documentados, no bloquean el control anti-escalada).

*No afirma cumplimiento legal ni fiscal completo.*
