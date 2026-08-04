# Feature Based Components Migration Report

**Fecha:** 2026-07-30  
**Estado:** ✅ TypeScript compila · ✅ Quality gate pasa · Sin cambios funcionales

---

## Resumen

| Métrica | Valor |
|---------|-------|
| Componentes movidos | **293** |
| Imports actualizados | **232** |
| Stubs `@deprecated` en rutas legacy | **293** |
| `src/components/ui/` (primitivos reutilizables) | **14 archivos** (13 reales + 1 stub) |

---

## Estructura resultante

```
src/
├── components/
│   └── ui/                    # Solo primitivos reutilizables (Button, Card, Input…)
│   └── {domain}/              # Stubs @deprecated → re-exportan desde feature/core
├── core/components/           # Shell de plataforma (layout, auth, theme, command-palette…)
└── features/{domain}/components/  # UI específica de cada bounded context
```

---

## Destinos por dominio

### `src/core/components/` — plataforma (42 archivos)

`layout`, `theme`, `command-palette`, `auth`, `legal`, `manual`, `qa`, `onboarding`, `accessibility`, `brand`, `landing`, `pwa`, `trial`, `updates`, `booking`

### `src/features/*/components/` — dominio (251 archivos)

| Feature | Carpeta(s) movida(s) | Archivos |
|---------|----------------------|----------|
| pacientes | `pacientes/` + `patient-whatsapp-button` desde ui | 60 |
| historias | `historias/` | 31 |
| recetas | `recetas/` | 20 |
| agenda | `agenda/`, `recordatorios/` | 11 |
| dashboard | `dashboard/`, `reportes/` | 21 |
| configuracion | `configuracion/` | 24 |
| caja | `caja/` | 4 |
| portal | `portal/` | 11 |
| pami | `pami/` | 2 |
| pharmacology | `pharmacology/` | 10 |
| profesionales | `profesionales/` | 11 |
| ia | `clinical-workflow/`, `admin-ops/` | 31 |
| integraciones | `datos/` | 5 |
| administracion | `secretaria/`, `atenciones/` | 3 |
| telemedicina, voice, plugins, facturacion | respectivos | 1–2 c/u |

---

## Compatibilidad hacia atrás

Cada ruta legacy conserva un stub:

```typescript
/** @deprecated Use @/features/pacientes/components/pacientes/patient-chart-view */
export * from "@/features/pacientes/components/pacientes/patient-chart-view";
```

Los imports `@/components/pacientes/...` siguen resolviendo sin cambio de comportamiento.

---

## Server / Client Components

- Se preservaron todas las directivas `"use client"` en los archivos movidos.
- No se alteró la lógica de renderizado ni boundaries RSC/Client.
- TypeScript valida correctamente las importaciones cross-feature.

---

## Duplicaciones eliminadas

- **`patient-whatsapp-button`**: removido de `components/ui/` (dominio paciente) → `features/pacientes/components/`.
- **`ui/`** queda exclusivamente con primitivos de diseño reutilizables.

---

## Validación

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` | ✅ |
| `npm run quality:gate:fast` | ✅ (484 tests) |
| Lint | ✅ |
| Architecture / Stabilization / Security gates | ✅ (actualizados para nuevas rutas) |

---

## Script de migración

`scripts/feature-components-migrate.mjs` — idempotente, re-ejecutable.

Metadatos: `coverage/feature-components-migration.json`

---

## Mejoras futuras

1. Eliminar stubs `@/components/{domain}/` tras migrar imports restantes en tests/scripts externos.
2. Aplanar rutas redundantes (`features/pacientes/components/pacientes/` → `features/pacientes/components/`).
3. Exportar componentes públicos desde `features/*/index.ts` usando las nuevas rutas.
4. Regla ESLint `no-restricted-imports` para bloquear `@/components/` excepto `@/components/ui/`.
