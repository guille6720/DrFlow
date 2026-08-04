# 002 — Embedded AI in consultation journey (Phase J)

**Date:** 2026-08-04  
**Status:** accepted  
**Triggers:** orchestrator (close-encounter reuse), large-component (finish step)

## Context

IA clínica existed per workflow (evolution, Rx, order) but Fin and Próximo turno lacked inline assist. Close wizard was a separate sheet (`?action=cerrar`), breaking the linear journey.

## Decision

| Step | Assist |
|------|--------|
| Evolución | `ConsultationPhysicianAssist` (unchanged) |
| Receta / Orden | `PrescriptionPhysicianAssist` / `OrderPhysicianAssist` (unchanged) |
| Próximo turno | `FollowUpPhysicianAssist` → prefills notes on **Aplicar** |
| Fin | `CloseEncounterWizardPanel` embedded in `ConsultationJourneyFinishStep` |

Extracted `CloseEncounterWizardPanel` from sheet; sheet reuses panel for `?action=cerrar`.

All outputs remain confirm-first (`InlinePhysicianAssist`, copy/review on close drafts). No auto-save.

## Consequences

- Standalone cerrar wizard unchanged for non-journey paths
- Copilot global remains secondary
- Follow-up: collapse PreVisitBrief into evolution banner (Phase J-b)
