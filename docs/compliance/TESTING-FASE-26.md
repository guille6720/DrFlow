# Testing — Fase 26

> Campaña de verificación del branch `compliance/argentina-monetization`.  
> **No se ocultan fallos.** Se separan preexistentes vs introducidos por este trabajo.

Fecha de corrida: **2026-08-24**

Catálogo: `src/core/compliance/testing-campaign.ts`

---

## Suites ejecutadas

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Lint | `npm run lint` | **PASS** (tras autofix import-sort) |
| Typecheck | `npx tsc --noEmit` | **PASS** |
| Unit (completo) | `npx vitest run` | **FAIL parcial** — ver ledger |
| RLS (+ integration) | `npm run test:rls` | **PASS** estático; integration **skipped** (sin `DRFLOW_RLS_INTEGRATION=1`) |
| Build | `npm run build` | **PASS** |
| Tenant isolation | vitest `tenant-isolation-fase10` | **PASS** (vía commercial gate) |
| AI sanitization | sanitize + failsafe | **PASS** |
| Authorization | permissions + member-permissions | **PASS** |
| Payment / webhook | mercadopago + monetization-fase19 | **PASS** |
| Commercial gate | `npm run commercial:gate` | **PASS** |

---

## Fallos introducidos por este trabajo → corregidos en Fase 26

| Test | Causa | Remedición |
|------|-------|------------|
| `migrations-consistency` | Latest esperado `128_*`; branch llegó a `137_*` | Expectativas actualizadas a `137_subscription_cancellation.sql` |
| `csrf-audit` | Webhook MP POST sin CSRF de browser | Allowlist de `verifyMercadoPagoWebhookSignature` (HMAC) |

---

## Fallos preexistentes (no introducidos por fases 13–25)

| Test | Resumen |
|------|---------|
| `clinical-workflow-context` | `patientWorkflowHref` ya no apunta a `/pacientes/...` como esperaba el test |
| `lib-core` / `patient-workspace-tabs` | `patientClinicalHistoryPath` sin `&action=nueva` |
| `xss-audit` | `dangerouslySetInnerHTML` fuera del allowlist de theme bootstrap |
| `performance/dashboard-first-paint` | Assertions de quick actions desalineadas con UI |

Estos **no se “esconden”**: quedan abiertos como deuda de producto/seguridad UI previa.

---

## Integración RLS con JWT

Sin `DRFLOW_RLS_INTEGRATION=1` + credenciales staging, los tests de JWT se **skipped** (esperado). Recomendado correrlos en staging antes de producción.

---

## Veredicto técnico de la fase

**OK con fallos preexistentes documentados.**

- Controles del trabajo de compliance (lint limpio, tsc, build, commercial gate, suites RLS/AI/pagos/auth) **pasan**.
- Quedan **5 áreas de test** con fallos previos al scope de monetización/compliance Argentina (navegación HC, XSS allowlist, dashboard paint).

*No afirma que el repo esté 100% verde en `vitest run` completo.*
