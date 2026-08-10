# DrFlow — Auditoría React/Next.js (PROMPT 06)

**Fecha:** 2026-08-10

## Resumen

| Cambio | Impacto | Archivos |
|--------|---------|----------|
| Prefetch slots turnos en SSR | −1 round-trip client al abrir `/turnos/nuevo` | `turnos/nuevo/page.tsx`, `turnos-nuevo-wizard.tsx` |
| Auditoría SSR en `?tab=auditoria` | −1 server action post-mount | `patient-workspace-content.tsx`, `patient-clinical-audit-panel.tsx` |
| Quitar `router.refresh()` tras `router.push` | Evita doble fetch RSC | `delete-patient-button`, `turnos-nuevo-wizard` |
| Share app: refresh opcional | Evita reload completo en ficha paciente | `patient-app-share-control.tsx` |
| Dashboard poll solo tab visible | Menos refresh en background | `clinical-ops-realtime.tsx` |
| Quitar `"use client"` de fetch util | Bundle más limpio | `fetch-patient-search.ts` |

## Antes / después estimado

| Pantalla | Antes | Después |
|----------|-------|---------|
| `/turnos/nuevo` (prof. default) | SSR metadata + client fetch slots | Slots en SSR, 0 fetch inicial |
| `/pacientes/[id]?tab=auditoria` | Full workspace + client audit fetch | Workspace + audit en paralelo SSR |
| Eliminar paciente → listado | push + refresh | push solamente |
| Compartir app en ficha | refresh página completa | estado local |

## No implementado (requiere diseño)

| Issue | Motivo |
|-------|--------|
| Tab-scoped workspace loading | Cambio arquitectónico; tab switch recarga ~10 queries |
| Split turnos wizard (913 LOC) | Interactivo; prefetch SSR es suficiente por ahora |
| Unificar hooks debounced search | Mantenibilidad, no runtime |

## Áreas ya bien estructuradas

- Dashboard: RSC + `ClinicalOpsRealtime` island
- `/pacientes` listado: RSC + client search form
- `/pami/planillas`: RSC loader + client form sections
- Historias list: RSC con joins embebidos
- `PatientsListCards`: `memo` en filas

## Reglas aplicadas

- Server Components para datos estáticos/semi-estáticos
- Client islands solo donde hay hooks, forms, router
- `router.refresh()` solo en mutaciones same-page
- Sin memoization prematura en listas ya optimizadas
