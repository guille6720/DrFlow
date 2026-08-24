# INFORME FINAL — PLANES DRFLOW

## Resumen

Se implementó en el código y migración **138** el modelo comercial **DrFlow Essential / Pro** con promoción de **6 meses facturables**, snapshot de precios en `clinic_subscriptions`, entitlements (asientos, IA 1000, storage), checkout/webhook Mercado Pago **Checkout Pro one-shot** y UI en español. **No se migraron clínicas legacy** ni se tocó producción.

## Catálogo

| Plan | Promo (6 meses) | Regular | Profesionales | Storage | IA |
|------|-----------------|---------|---------------|---------|-----|
| Essential | ARS 25.000/mes | ARS 35.000/mes | 1 | 5 GB | OFF |
| Pro | ARS 40.000/mes | ARS 55.000/mes | hasta 5 | 25 GB | ON, 1000/mes |

- Trial cardless: **14 días** (`TRIAL_PROMO_DAYS` / `TRIAL_DAYS_INCLUDED`).
- SKUs históricos `solo` / `consultorio` / `clinica`: dejan de venderse; siguen parseables en `external_reference`.
- Planes comerciales `legacy`, `trial`, `basic`, `premium`, `enterprise` no se borran; `basic`/`premium` quedan `is_public=false` para venta nueva.

## Piezas técnicas

- `src/core/billing/commercial-pricing.ts` — `addBillingMonths`, `resolveEffectivePrice`, snapshots.
- `src/core/billing/checkout-amount.ts` — monto efectivo con snapshot / upgrade.
- `src/core/billing/plan-change.ts` — upgrade sin reiniciar promo; downgrade bloqueado si >1 profesional.
- `src/core/billing/plans.ts` — catálogo Essential/Pro + históricos.
- `billing-plan-map.ts` / `plan-keys.ts` — `essential→essential`, `pro→pro`; legacy map intacto.
- `mercadopago.ts` + `subscription-service.ts` + `monetization-security.ts` — monto vs precio efectivo.
- Migración `138_commercial_essential_pro.sql` + `VERIFY_138_…sql`.
- UI: `/planes`, panel de plan, superadmin (billing + promo/regular + usos).
- Tests: `tests/commercial-essential-pro.test.ts` (+ ajustes billing/map/migrations).

## WARNING documentados

1. **Mercado Pago:** se mantiene one-shot Checkout Pro. La “transición automática” de promo→regular aplica al **próximo checkout/preferencia**, no a un cargo MP sin intervención (Preapproval fuera de alcance).
2. **Storage:** si la medición está incompleta, no se borran archivos clínicos.
3. **Downgrade:** no elimina profesionales ni datos; bloquea si hay más de 1 profesional activo.
4. **Cancelación:** se conserva paid-through (fase 21).

## Staging

- Aplicar **solo staging** con gates existentes (`supabase:preflight:staging` + apply 138).
- Verificar con `supabase/migrations/rollback/VERIFY_138_commercial_essential_pro_staging.sql`.
- Reporte orientativo: `node scripts/report-commercial-clinics-staging.mjs`.

## Fuera de alcance (cumplido)

- Deploy producción.
- Migración automática de clínicas legacy/basic → Essential/Pro.
- Preapproval / cargo recurrente MP.
- Add-on de IA de pago nuevo.
- Edición de migraciones 100–137.

---

No realicé cambios en producción. La implementación quedó preparada para revisión y validación en staging.
