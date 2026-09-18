# Entrega STAGING — Módulo Geriatría + product entitlements

**Fecha:** 2026-09-08  
**Repo:** `DrFlow-staging` (branch `release/0.2.19-staging-promotion`)  
**Confirmación expresa:** **PRODUCCIÓN NO MODIFICADA**

---

## 1. Resumen de arquitectura implementada

- Tenant sigue siendo `clinics.clinic_id` (sin `organization_id`).
- Productos de plataforma **independientes** del plan comercial:
  - `product.clinic` / `product.geriatrics` vía tabla `clinic_products`.
  - Mutación **solo Superadmin** (`set_clinic_product` + `assert_entitlement_superadmin`).
  - Lectura miembros de clínica (`get_clinic_products`).
  - Backfill: clínicas existentes → Clínica ON, Geriatría OFF.
- Módulo Geriatría: tablas `geriatrics_*`, RLS por `clinic_id`, registros clínicos append-only.
- Residentes = extensión de `patients` (`patient_id`), sin duplicar identidad.
- Feature gating: nav + `dashboard-data-shell` + layout `/geriatria`.
- Pricing Geriatría centralizado en `src/core/billing/product-pricing.ts` (sin checkout automático).

Informe Fase 1: `docs/architecture-reviews/008-geriatrics-module-phase1-audit.md`

---

## 2. Migraciones creadas

| Archivo | Contenido |
|---------|-----------|
| `supabase/migrations/158_clinic_products.sql` | `clinic_products`, RPCs, RLS, audit, backfill, trigger seed |
| `supabase/migrations/159_geriatrics_module.sql` | Dominio geriátrico completo + RLS + append-only |

**Estado:** aplicadas en **staging** (`gprmsufvhabntbrytwyi`) el 2026-09-08 vía deploy selectivo (`scripts/geriatrics-staging-selective.mjs`). **No** aplicadas a producción.

---

## 3. Tablas nuevas

`clinic_products`, `geriatrics_rooms`, `geriatrics_beds`, `geriatrics_residents`, `geriatrics_resident_status_history`, `geriatrics_bed_assignments`, `geriatrics_nursing_shifts`, `geriatrics_nursing_notes`, `geriatrics_medication_orders`, `geriatrics_medication_administrations`, `geriatrics_care_plans`, `geriatrics_care_plan_items`, `geriatrics_assessment_definitions`, `geriatrics_assessments`, `geriatrics_evolutions`, `geriatrics_nutrition_profiles`, `geriatrics_nutrition_logs`, `geriatrics_incidents`, `geriatrics_contacts`, `geriatrics_transfers`

---

## 4. RLS / policies

- `clinic_products`: SELECT miembros/superadmin; mutación solo RPC superadmin.
- Tablas `geriatrics_*`: SELECT por membership; INSERT/UPDATE roles `clinic_admin|doctor|secretary` (+ superadmin).
- Append-only triggers: nursing notes, medication administrations, evolutions.
- Escalas: placeholders sin texto de cuestionarios protegidos.

---

## 5. Entitlements nuevos

| Key | Fuente | Default post-migración |
|-----|--------|-------------------------|
| `product.clinic` | `clinic_products` | `true` (backfill) |
| `product.geriatrics` | `clinic_products` | `false` |

App: `src/core/products/*`, `ProductsProvider`, `requireProduct`, route gates.

---

## 6. Rutas creadas

- `/geriatria` (+ 11 subsecciones)
- `/sin-productos`
- Superadmin: sección Productos en `/superadmin/clinics/[clinicId]`

---

## 7. Componentes creados (principales)

- `SuperadminClinicProductsForm`
- `GeriatricsPricingSection` / `product-pricing.ts`
- `GeriatricsSectionPage`, dashboard KPIs
- `ProductsProvider`

---

## 8. Cambios Superadmin

UI “Productos habilitados” con toggles Clínica / Geriatría, audit en RPC (`old_values`/`new_values`, actor, fecha).

---

## 9. Landing

Tarjetas Geriatría y Clínica+Geriatría en home y `/planes`. CTA “Solicitar demo” (WhatsApp). Sin checkout automático.

---

## 10–11. Tests

| Test | Resultado |
|------|-----------|
| 1 Clínica ON / Geriatría OFF | **PASS** (unit: routes) |
| 2 Clínica OFF / Geriatría ON | **PASS** (unit) |
| 3 Ambos ON | **PASS** (unit) |
| 4 Ambos OFF | **PASS** (unit) |
| 5 Owner habilita vía action | **PASS** (código: `requireSuperadminOrDeny` → DENEGADO) |
| 6 Superadmin + audit | **PENDING apply** (requiere migración 158 en staging) |
| 7 Aislamiento tenant | **PENDING apply** (RLS definida; falta prueba E2E staging) |
| 8 URL `/geriatria` OFF | **PASS** (unit + layout redirect) |
| 9 Dark/light | **PASS** (usa design system existente; sin estilos nuevos hardcoded) |
| 10 Regresión DrFlow | **PENDING** (fail-open clinic sin catálogo; backfill ON) |

Suite: `tests/products-geriatrics-entitlements.test.ts` → **7/7 PASS**.

---

## 12. Riesgos

- Migraciones 158–159 aún no aplicadas en DB staging.
- Types Supabase no regenerados (bridge `asUntypedDb`).
- Subsecciones UI son shells operativos; CRUD completo pendiente.
- Gate `product.clinic=false` es comportamiento nuevo — validar onboarding.
- Escalas: solo placeholders por licencia.

---

## 13. Pendientes

1. Aplicar 158–159 en staging con safety gate.
2. Regenerar `supabase.ts`.
3. CRUD completo residentes/camas/eMAR/UI mapas.
4. E2E TEST 6–7–10 contra staging live.
5. Screenshots desktop/mobile (requiere app corriendo + migración).
6. Promoción manual a producción (fuera de alcance).

---

## 14. Screenshots

No generados en esta entrega (DB/migración pendiente). Validar visualmente post-apply en staging.

---

## 15. Confirmación

**PRODUCCIÓN NO MODIFICADA.**  
Sin `db push` a `nipqdarduknydqptqzup`. Sin promoción. Esperar aprobación manual para aplicar staging y luego producción.
