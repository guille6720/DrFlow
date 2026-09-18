# 008 — Geriatría: auditoría de arquitectura (Fase 1)

**Ámbito:** `DrFlow-staging` únicamente (`gprmsufvhabntbrytwyi`).  
**Producción:** no modificada.  
**Fecha:** 2026-09-08  
**Estado:** informe previo a implementación — sin cambios de código/DB en esta fase.

---

## 1. Modelo de tenant

| Concepto | Realidad en DrFlow |
|----------|-------------------|
| Tenant | `public.clinics` (`clinic_id`) |
| Membresía | `clinic_members` (`clinic_id`, `user_id`, `role`, `is_active`) |
| `organization_id` | **No existe** — “organización” = clínica en APIs/docs |
| Superadmin | `profiles.is_superadmin` + helpers SQL `is_superadmin()` |

**Decisión:** todas las tablas de Geriatría usarán `clinic_id`. No introducir `organization_id`.

---

## 2. Roles

Enum real: `superadmin` | `clinic_admin` | `doctor` | `secretary` | `patient`.

| Spec | Mapeo DrFlow |
|------|----------------|
| Owner | Informal: primer `clinic_admin` |
| Admin | `clinic_admin` |
| Profesional | fila `professionals` + rol `doctor` |
| Superadmin | `profiles.is_superadmin` |

Permisos app: `src/core/permissions/roles.ts` + overrides en `clinic_member_permissions`.  
HC clínica: `can_view_clinical` / `can_write_clinical` → admin + doctor (secretary excluida).

---

## 3. Planes / subscriptions / entitlements (3 capas)

| Capa | Tablas | Rol |
|------|--------|-----|
| **Comercial (features)** | `plans`, `features`, `plan_features`, `clinic_entitlement_subscriptions`, `clinic_feature_overrides`, `feature_usage` | Gate de add-ons / cupos |
| **Billing MP** | `clinic_subscriptions` | Cobro Mercado Pago |
| **UX flags/plugins** | `clinic_feature_flags`, `clinic_plugins` | Toggles de UI |

Helpers: `src/core/entitlements/` (`requireFeature`, `FeatureGate`, `get_clinic_entitlements`).  
Superadmin comercial: `/superadmin/clinics/[clinicId]`, `/qa/comercial`.

**Hallazgo crítico:** hoy el **clínico core está ungated** (`CORE_UNGATED_FEATURES` + `EXISTING_MODULE_ENFORCEMENT_DEFERRED`). No existe namespace `product.*`.

---

## 4. Navegación

Fuente: `src/features/_shared/nav.ts` → filtro en `sidebar.tsx`:

1. Permisos RBAC  
2. Plugins  
3. Feature flags  
4. Entitlements comerciales (`nav-features.ts`)

Rutas también gated en `dashboard-data-shell.tsx`.

---

## 5. Dominio clínico existente (reutilizar)

| Dominio | Tabla / feature | Reuso para Geriatría |
|---------|-----------------|----------------------|
| Pacientes | `patients` | **Sí** — residente = paciente + extensión geriátrica |
| Profesionales | `professionals` | **Sí** |
| HC / evoluciones | `clinical_records` (+ audit) | **Sí** donde aplique; evoluciones multidisciplinarias pueden ser registros tipados o extensión |
| Recetas | `prescription_*` | Parcial — eMAR geriátrico es distinto (administración en residencia) |
| Diagnósticos | `clinical_diagnoses` / `clinical_record_diagnoses` | Catálogo compartido |
| Auditoría | `audit_logs` (inmutable) + `clinical_record_audit` | **Sí** — `recordAudit` / `recordAuditChange` |
| Residencia geriátrica | — | **No existe** (solo PAMI `geriatrico` / especialidad “Geriatría”) |

---

## 6. Pricing / landing

- Precios clínicos: `src/core/billing/commercial-pricing.ts`, `plans.ts`, `plans.metadata`.  
- Landing/planes: `(marketing)/planes`, `plans-pricing-section.tsx`.  
- **No** hardcodear precios de Geriatría en componentes clínicos; extender catálogo comercial.

---

## 7. Seguridad / RLS

Patrón estándar:

- `clinic_id IN (user_clinic_ids())` o `user_role_in_clinic`
- Mutaciones sensibles vía RPC `SECURITY DEFINER` + `assert_*_superadmin`
- Tenant trust: `resolveTrustedClinicId`
- Manifest: `rls-manifest.ts` / `CLINIC_SCOPED_TABLES`

Staging: `gprmsufvhabntbrytwyi`. Producción: `nipqdarduknydqptqzup` — **nunca** target de este trabajo.

---

## 8. Diseño propuesto (Fases 2+)

### 8.1 Productos (`product.clinic` / `product.geriatrics`)

**No** son features de plan comprables por el owner. Son **productos de plataforma** controlados solo por Superadmin.

Propuesta (backward-compatible):

1. Nueva tabla `clinic_products`  
   - `(clinic_id, product_key, enabled, updated_at, updated_by)`  
   - `product_key ∈ ('clinic','geriatrics')`  
   - UNIQUE `(clinic_id, product_key)`
2. RPC `set_clinic_product` — **solo** `assert_entitlement_superadmin` (o equivalente).
3. RPC `get_clinic_products(clinic_id)` — miembros de la clínica + superadmin.
4. Migración de datos: para **todas** las clínicas existentes → `clinic=true`, `geriatrics=false` (preserva comportamiento actual = TEST 1).
5. Default para clínica nueva sin filas: ambos `false` (TEST 4) **o** al crear clínica seed `clinic=true` según política comercial — documentar en migración.
6. App: `PRODUCTS.CLINIC` / `PRODUCTS.GERIATRICS` + `requireProduct` / `ProductGate` (server + nav + API). Independiente de `CORE_UNGATED_FEATURES`.
7. Auditoría obligatoria en cada toggle (old/new, actor, clinic_id) vía `audit_logs`.
8. Opcional: espejo en catálogo `features` (`product.clinic` / `product.geriatrics`) **solo** para reporting; la fuente de verdad de habilitación es `clinic_products`.

**Por qué no solo `clinic_feature_overrides`:** los overrides son parte del modelo de planes/add-ons; un owner/admin con UI comercial podría confundirse; hace falta UI/RPC dedicada “Productos habilitados” y denegación explícita fuera de superadmin.

### 8.2 Módulo Geriatría (dominio)

Prefijo tablas: `geri_*` o `geriatrics_*` (elegir uno y mantener).

| Submódulo | Enfoque |
|-----------|---------|
| Residentes | `geriatrics_residents` 1:1 opcional con `patients` (`patient_id`, `clinic_id`) + campos geriátricos + historial estado |
| Habitaciones/camas | `geriatrics_rooms`, `geriatrics_beds`, `geriatrics_bed_assignments` (append-only historial) |
| Enfermería | `geriatrics_nursing_notes` append-only / correcciones auditadas |
| Medicación eMAR | `geriatrics_medication_orders` + `geriatrics_medication_administrations` (sin overwrite silencioso) |
| Plan de cuidados | `geriatrics_care_plans` + items |
| Escalas | motor `geriatrics_assessment_definitions` + `geriatrics_assessments` (sin textos protegidos hasta verificar licencia) |
| Evoluciones | preferir `clinical_records` con metadata/specialty **o** `geriatrics_evolutions` que referencie HC |
| Nutrición / incidentes / contactos / traslados / reportes | tablas propias + RLS |
| Resumen 24/48/72h | agregación determinística server-side; hook futuro IA si ya hay pipeline sanitizado |

### 8.3 Nav / feature gating

- Grupo sidebar **Geriatría** si `product.geriatrics`.
- Si solo geriatría: ocultar agenda/consultas/caja/PAMI/telemedicina/etc. específicas de clínica ambulatoria; mantener dashboard adaptado, pacientes (o “Residentes”), config, reportes geriátricos, equipo.
- Si ambos: nav clínica actual + grupo Geriatría.
- Si ninguno: shell mínimo + pantalla “sin productos activos”.
- Rutas `/geriatria/*` → `requireProduct('geriatrics')`; rutas clínicas exclusivas → `requireProduct('clinic')` **sin** romper auth/config/usuarios.

### 8.4 Pricing landing

Extender `commercial-pricing.ts` (o módulo hermano `product-pricing.ts`) con SKUs Geriatría / Clínica+Geriatría. Landing: tarjeta comercial + CTA “Solicitar demo” **sin** checkout automático de Geriatría.

### 8.5 Escalas — licencia

Implementar motor extensible; seed inicial solo escalas de uso libre / dominio público tras verificación. **No** copiar Mini-Mental u otras protegidas hasta confirmar licencia. Barthel/Katz/Braden/Morse: verificar caso por caso antes de textos íntegros.

---

## 9. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Gatear `product.clinic=false` rompe clínicas actuales | Backfill `clinic=true` en migración |
| Confundir productos con planes comerciales | Tabla + RPC + UI Superadmin separadas |
| Duplicar pacientes | FK a `patients`; no segunda identidad |
| Migraciones destructivas | Solo ADDITIVE; sin DROP de datos clínicos |
| Licencias de escalas | Motor vacío + escalas verificadas |
| Scope enorme del módulo | Entregar entitlements + shell + esquema + submódulos MVP iterativos en staging |
| `config.toml` apunta a prod project_id | Usar siempre `--project-ref gprmsufvhabntbrytwyi` |

---

## 10. Orden de implementación recomendado

1. Migración `clinic_products` + RLS + RPC + audit + backfill  
2. Helpers app `requireProduct` / snapshot  
3. Superadmin “Productos habilitados”  
4. Nav + route guards + pantalla sin productos  
5. Feature module + rutas `/geriatria/*` skeleton  
6. Migraciones dominio (rooms → residents → nursing → eMAR → …)  
7. UI subsecciones + dashboard KPIs  
8. Landing pricing  
9. Tests TEST 1–10 en staging  

---

## 11. Confirmación de alcance de esta fase

- **PRODUCCIÓN NO MODIFICADA**  
- Ninguna migración aplicada  
- Ningún cambio de código de producto aún (solo este informe)

**Siguiente paso:** implementar Fase 2 (entitlements por producto) en staging según §8.1.
