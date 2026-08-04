# Clinical Workflow Report — Enterprise Stabilization

**Date:** 2026-07-30  
**Focus:** Physician-centered flow, minimum clicks, no feature removal

---

## 1. Ideal flow (target state)

```
Paciente → Consulta → Evolución → Receta → Orden → Próximo turno → Fin
```

All steps occur **inside patient workspace** when `appointmentId` is present (Consultation Journey — Phase I/J).

---

## 2. Workflow audit by area

| Workflow | Status | Clicks to complete | Notes |
|----------|--------|-------------------|-------|
| **Patient search** | ✅ Optimized | 1 (Ctrl+K) | Command palette + patient combobox; refactored palette hooks |
| **Open patient** | ✅ | 1 | Global search → `/pacientes/[id]` |
| **10s situational awareness** | ✅ | 0 extra tabs | Clinical Workspace resumen (2026-07-30) |
| **Start consultation** | ✅ | 1 | Header + action bar → SOAP sheet in patient shell |
| **Consultation journey** | ✅ | Linear stepper | evolution → receta → orden → follow-up → fin |
| **SOAP note** | ✅ | In-context sheet | `PatientConsultSheet` + journey stepper |
| **Prescription** | ✅ | In-context sheet | Journey step + recetas tab |
| **Medical orders** | ✅ | In-context sheet | Journey step + ordenes tab |
| **Study review** | ✅ | 1 | Resumen studies section → estudios/archivos tab |
| **Follow-up appointment** | ✅ | Journey step | `FollowUpPhysicianAssist` (confirm only) |
| **Finish encounter** | ✅ | Journey fin step | `CloseEncounterWizardPanel` + AI assist |
| **Ops dashboard** | ✅ | 0 navigation | Clinical Operations Center — queue/alerts/Rx |

---

## 3. AI assistance (physician confirmation required)

| Location | Feature | Auto-save |
|----------|---------|-----------|
| Consultation finish | Close encounter wizard | ❌ Never |
| Follow-up step | Follow-up assist | ❌ Never |
| Resumen tab | Clinical summary assist | ❌ Clipboard apply only |
| Copilot overlay | Conversational | ❌ Confirm actions |

Feature flag: `consultation_assistant`

---

## 4. Remaining friction (medium priority)

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| PreVisitBrief separate panel | Extra scroll above tabs | Merge into evolution step |
| Global copilot vs step copilot | Two AI entry points | Unify trigger in action bar |
| Legacy `/historias/nueva` route | Parallel entry | Deprecate banner → patient workspace |
| Structured vitals capture | Manual text parse | Future `patient_vitals` table |

---

## 5. Metrics

- **Patient context preserved:** All clinical sheets use `PatientWorkspaceSheets` overlay
- **External navigation during consult:** Eliminated when journey active
- **Quick actions:** Action bar + FAB (dashboard) + header buttons (workspace)

---

*No working functionality removed. Workflow optimized via layout + journey + gates.*
