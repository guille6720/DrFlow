# Deduplication Report — Features & Components

**Fecha:** 2026-07-30  
**Estado:** ✅ TypeScript compila · ✅ Quality gate pasa · API pública preservada

---

## Resumen ejecutivo

Se analizaron **30 feature modules**, **292 componentes activos** y **293 stubs de transición** en `src/components/`. La deuda principal era **path duplication** (migración Feature First), no lógica copiada masivamente. Se centralizaron **10 responsabilidades duplicadas** con stubs `@deprecated` para compatibilidad.

| Métrica | Valor |
|---------|-------|
| Implementaciones duplicadas eliminadas | **3** (WhatsApp URL builders) |
| Módulos recentralizados | **10** |
| Imports actualizados a rutas canónicas | **74+** |
| API pública (`features/*/index.ts`) | **Intacta** (+ `orderTypeLabel` en recetas) |
| Tests | **484 passed** |

---

## Duplicaciones eliminadas

### 1. WhatsApp URL building (lógica repetida)

**Problema:** Tres implementaciones distintas para armar links `wa.me`:
- `src/lib/utils/whatsapp.ts` — normalización AR completa ✅
- `buildOrderWhatsAppUrl()` en recetas — sin normalización
- Inline `wa.me` en `share-prescription-buttons.tsx`

**Centralizado en:** `src/shared/utils/whatsapp.ts`

| Función | Responsabilidad |
|---------|-----------------|
| `normalizeArgentinaPhone` | Normalización teléfono AR |
| `buildWhatsAppUrl` | Link con número + mensaje |
| `buildWhatsAppShareUrl` | Link sin número (picker de contacto) |

**Eliminado:**
- `buildOrderWhatsAppUrl()` (función duplicada)
- 2 bloques inline de construcción URL en recetas

**Compatibilidad:** `src/lib/utils/whatsapp.ts` → stub `@deprecated`

**Consumidores actualizados:**
- `share-prescription-buttons.tsx`
- `prescriptions-orders-patient-sidebar.tsx`
- `patient-whatsapp-button.tsx`

---

### 2. `orderTypeLabel` (util de dominio en componentes)

**Problema:** Función de dominio recetas mezclada con util WhatsApp duplicado en `prescriptions-orders-utils.ts`.

**Centralizado en:** `src/features/recetas/utils/order-type-label.ts`

**Export público:** añadido a `features/recetas/index.ts` (extensión API, no breaking)

**Compatibilidad:** `prescriptions-orders-utils.ts` → stub que re-exporta `orderTypeLabel`

---

### 3. Plugin / Feature-flag providers (exports duplicados)

**Problema:** `features/plugins/index.ts` y `features/flags/index.ts` importaban el mismo provider desde la misma ruta de componente — dos barrels apuntando al mismo origen.

**Centralizado en:** `src/features/plugins/providers.ts`

**Exports unificados:**
- `ClinicPluginsProvider`, `useClinicPlugins`, `usePluginEnabled`
- `ClinicFeaturesProvider`, `useClinicFeatures`, `useFeatureFlag`

**API preservada:** ambos `plugins/index.ts` y `flags/index.ts` mantienen los mismos nombres exportados.

---

### 4. Physician assist types (tipos IA dispersos)

**Problema:** Tipos de dominio IA (`PhysicianAssistContext`, `PhysicianAssistItem`, etc.) vivían en `lib/utils/` mientras 20+ archivos de `features/ia/` los consumían.

**Centralizado en:** `src/features/ia/types/physician-assist-types.ts`

**Compatibilidad:** `src/lib/utils/physician-assist-types.ts` → stub

**Barrel actualizado:** `features/ia/index.ts` exporta desde ruta canónica

**Imports actualizados:** 30+ archivos en ia, historias, recetas, pacientes, core/jobs

---

### 5. Voice input utilities (lib huérfano)

**Problema:** Utilidades de voz en `lib/features/voice-input.ts` fuera del feature `voice`.

**Centralizado en:** `src/features/voice/lib/voice-input.ts`

**Compatibilidad:** `src/lib/features/voice-input.ts` → stub

**Barrel actualizado:** `features/voice/index.ts`

---

### 6. Patient chart types (nombres ambiguos duplicados)

**Problema:** Dos archivos `patient-chart-types.ts` con responsabilidades distintas:
- **Modelo de dominio** (payload, alerts, vitals) en `utils/`
- **Props de vista** (PatientChartViewProps) en `components/`

**Centralizado en:**
| Archivo | Rol |
|---------|-----|
| `utils/patient-chart-model-types.ts` | Modelo de dominio |
| `components/pacientes/patient-chart-view-types.ts` | Props UI |

**Compatibilidad:** stubs `@deprecated` en rutas antiguas + `lib/utils/patient-chart-types.ts`

**Imports actualizados:** 40+ archivos en pacientes, historias, ia

---

### 7–9. Hooks fuera de su feature (ownership incorrecto)

| Hook | Antes | Después |
|------|-------|---------|
| `useProfessionalIntake` | `lib/hooks/` | `features/profesionales/hooks/` |
| `useConfiguracionNavigator` | `lib/hooks/` | `features/configuracion/hooks/` |
| `useSpeechToText` | `lib/hooks/` | `features/voice/hooks/` |

**Compatibilidad:** stubs en `lib/hooks/*`

---

### 10. Observability / Accessibility (cadena lib redundante)

**Problema:** `features/observability` y `features/accessibility` re-exportaban vía `@/lib/*` cuando `@/core/*` ya es canónico.

**Corregido:**
- `features/observability/index.ts` → `@/core/observability`
- `features/accessibility/index.ts` → `@/core/accessibility`

**API pública:** mismos exports, rutas internas simplificadas.

---

## Análisis — duplicaciones NO eliminadas (intencional)

| Cluster | Razón |
|---------|-------|
| **293 stubs `src/components/`** | Compatibilidad API post-migración Feature Components — eliminar en Fase 3 |
| **~70 stubs `src/lib/`** | Compatibilidad post Feature First — eliminar tras codemod imports |
| **`historias/patient-ehr-*` vs `pacientes/patient-chart-*`** | Capas UI distintas; modelo compartido ya en pacientes utils |
| **`plugins/registry.ts` vs `flags/lib/registry.ts`** | Registros de dominios diferentes (plugins vs feature flags) |
| **`features/core` vs `src/core`** | Facade de namespacing, no lógica duplicada |
| **Validaciones Zod** | Ya centralizadas en `src/core/validations/` — sin duplicación en features |
| **`use-pharmacology-search`, `use-professional-intake` en lib** | pharmacology hook pendiente de mover (1 hook restante en lib) |

---

## Validaciones centralizadas (sin duplicación detectada)

Todas las validaciones Zod viven en `src/core/validations/`:
- `schemas.ts`, `cash-schemas.ts`, `doctor-setup.ts`, `form-errors.ts`, `public-booking.ts`

Features consumen vía services/actions — **0 schemas duplicados** en features.

---

## Servicios (sin duplicación cross-feature)

Patrón DDD ya aplicado en dominios clínicos:
- `pacientes/services/` → único origen patients
- `historias/services/` → único origen clinical-records
- `recetas/services/` → prescriptions + medical-orders

No se encontraron services con lógica idéntica entre features.

---

## API pública preservada

Todos los barrels `features/*/index.ts` mantienen sus exports. Cambios:

| Barrel | Cambio |
|--------|--------|
| `recetas/index.ts` | **+** `orderTypeLabel` (extensión) |
| `ia/index.ts` | Ruta interna → `@/features/ia/types/physician-assist-types` |
| `voice/index.ts` | Ruta interna → `@/features/voice/lib/voice-input` |
| `flags/index.ts` | Providers vía `@/features/plugins/providers` |
| `plugins/index.ts` | Providers vía `@/features/plugins/providers` |
| `observability/index.ts` | Directo a `@/core/observability` |
| `accessibility/index.ts` | Directo a `@/core/accessibility` |

Stubs `@deprecated` garantizan que imports legacy (`@/lib/*`, rutas antiguas de types) sigan funcionando.

---

## Validación

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` | ✅ |
| `npm run quality:gate:fast` | ✅ |
| Tests | 484 passed |
| Comportamiento funcional | Sin cambios |

---

## Mejoras futuras (Fase 3)

1. **Eliminar 293 stubs `src/components/`** tras codemod masivo de imports
2. **Eliminar ~70 stubs `src/lib/`** tras completar Feature First Fase 2
3. **Mover `use-pharmacology-search`** → `features/pharmacology/hooks/`
4. **Aplanar rutas** `features/pacientes/components/pacientes/` → `features/pacientes/components/`
5. **Regla ESLint** `no-restricted-imports` para bloquear `@/lib/*` y `@/components/*` (excepto `ui/`)
6. **Portal hooks** en pacientes → evaluar mover a `features/portal/hooks/`

---

## Mapa de responsabilidades canónicas (post-dedup)

```
src/shared/utils/     → cn, whatsapp, clinical-navigation, clinic-timezone
src/core/             → auth, security, validations, observability, accessibility, jobs
src/features/{domain}/
  ├── types/          → tipos de dominio (ia/physician-assist-types)
  ├── utils/          → lógica pura (recetas/order-type-label, pacientes/chart-model-types)
  ├── hooks/          → estado UI del dominio
  ├── services/       → reglas de negocio
  ├── components/     → UI del dominio
  └── index.ts        → API pública del feature
src/features/plugins/providers.ts → providers React compartidos plugins+flags
src/components/ui/    → primitivos reutilizables únicamente
```
