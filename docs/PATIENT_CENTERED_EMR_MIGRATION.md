# Patient-Centered EMR — Migration Plan

**Project:** DrFlow  
**Date:** 2026-08-04  
**Status:** Phase 1 implemented (2026-08-04) — sheets, redirects, SOAP tab  
**Anchor route:** `/pacientes/[id]` (canonical patient shell)

---

## 1. Vision

Transform DrFlow from a **module-oriented** app (Pacientes · Historia clínica · Recetas as separate destinations) into a **patient-centered EMR** where:

- The patient record is the **only clinical context**.
- Every clinical action (consult, SOAP note, prescription, order, attachment upload) happens **inside** `/pacientes/[id]`.
- Navigation never leaves the patient shell during care delivery.
- Clinic-wide list views (`/historias`, `/recetas`, `/agenda`) remain as **entry points** that deep-link into the patient workspace.

---

## 2. Current State (baseline)

### What already exists ✅

DrFlow Phase 4 (`historia-clinica`) already built a tabbed patient workspace:

| Requested tab | Current tab ID | Status |
|---------------|----------------|--------|
| Summary | `resumen` | ✅ Full dashboard (`PatientChartView`) |
| Timeline | `timeline` | ✅ `PatientClinicalTimeline` (feature flag) |
| SOAP | — | ❌ **Missing** — no tab, no structured model |
| Diagnoses | `diagnosticos` | ✅ Derived from `clinical_records.diagnosis` |
| Problems | `problemas` | ⚠️ Heuristic from free text, no `problems` table |
| Allergies | `alergias` | ⚠️ Free text on `patients.allergies` |
| Medications | `medicacion` | ✅ Habitual + Rx history |
| Prescriptions | `recetas` | ⚠️ List in workspace; **create** → `/recetas` |
| Orders | `ordenes` | ⚠️ List in workspace; **create** → `/recetas?tipo=orden` |
| Studies | `estudios` | ✅ PDF attachments by category |
| Attachments | `archivos` | ✅ `ClinicalDocumentsPanel` |
| Vaccines | `vacunas` | ⚠️ JSON in `patients.notes`; edit via `/editar` |
| Audit | `auditoria` | ✅ `PatientClinicalAuditPanel` (feature flag) |
| AI | `ia` | ✅ `PatientClinicalAssistantPanel` (plugin) |

**Extra tabs today:** `evoluciones`, `vitales`, `interconsultas` (placeholder).

**Key files:**

```
src/app/(dashboard)/pacientes/[id]/page.tsx          → route entry
src/lib/constants/patient-workspace-tabs.ts          → tab registry
src/components/pacientes/patient-workspace-view.tsx  → tab router
src/lib/server/load-patient-workspace-page.ts        → combined payload
src/lib/utils/clinical-navigation.ts               → return-from-subpage helpers
```

### Where users leave patient context today ❌

| Action | Current destination | Clicks from workspace |
|--------|--------------------|-----------------------|
| Nueva consulta | `/historias/nueva?patient=` | 1 navigation + back |
| Ver/editar consulta | `/historias/[id]`, `/historias/[id]/editar` | 1 navigation + back |
| Nueva receta | `/recetas?patient=` | 1 navigation + back |
| Nueva orden | `/recetas?patient=&tipo=orden` | 1 navigation + back |
| Editar alergias/vacunas/labs | `/pacientes/[id]/editar#perfil-clinico` | 1 navigation + back |
| Iniciar consulta (agenda) | `/historias/nueva?patient=&appointment=` | leaves workspace |

**~40 code locations** link to `/historias/nueva` or `/recetas?patient=` (sticky bar, chart panels, dashboard, agenda, command palette, AI panel).

---

## 3. Target State

### 3.1 Tab model (final)

Consolidate to **14 primary tabs** aligned with the EMR spec. Spanish labels in UI; English IDs for docs/API.

| Tab ID | Label (UI) | Content | Notes |
|--------|------------|---------|-------|
| `resumen` | Resumen | Summary dashboard | Keep; add quick-action sheet triggers |
| `timeline` | Timeline | Unified clinical timeline | Promote; remove feature flag default-off |
| `soap` | SOAP | Structured SOAP editor + consult list | **New** — see §4.2 |
| `diagnosticos` | Diagnósticos | ICD-linked diagnosis list | Upgrade from derived rows |
| `problemas` | Problemas | Active problem list | Upgrade to structured (Phase C) |
| `alergias` | Alergias | Allergy list with inline CRUD | Move edit out of `/editar` |
| `medicacion` | Medicación | Habitual meds + active Rx | Keep; inline renew |
| `recetas` | Recetas | Rx list + **embedded composer** | No `/recetas` navigation |
| `ordenes` | Órdenes | Orders list + **embedded composer** | No `/recetas` navigation |
| `estudios` | Estudios | Lab/imaging PDFs | Keep |
| `archivos` | Archivos | General attachments | Keep; inline upload |
| `vacunas` | Vacunas | Vaccine schedule | Inline CRUD |
| `auditoria` | Auditoría | Audit trail | Keep |
| `ia` | IA | Clinical assistant | Keep |

**Demoted / merged:**

| Current tab | Fate |
|-------------|------|
| `evoluciones` | Merged into `soap` tab (consult browser + evolution text) |
| `vitales` | Section inside `resumen` + vitals block in `soap` consult detail |
| `interconsultas` | Deferred to Phase D (or hidden until implemented) |

### 3.2 URL contract (backward compatible)

```
/pacientes/[id]                              → resumen (default)
/pacientes/[id]?tab=soap                     → SOAP tab
/pacientes/[id]?tab=soap&record=[uuid]       → open consult detail drawer
/pacientes/[id]?tab=soap&action=nueva        → new consult sheet
/pacientes/[id]?tab=recetas&action=nueva     → new prescription sheet
/pacientes/[id]?tab=ordenes&action=nueva     → new order sheet
/pacientes/[id]?tab=archivos&action=upload   → upload sheet
```

**Legacy redirects (permanent, no breaking change):**

| Legacy URL | Redirect to |
|------------|-------------|
| `/historias/paciente/[id]` | `/pacientes/[id]?tab=soap` (was `evoluciones`) |
| `/historias?patient=[id]` | `/pacientes/[id]?tab=soap` |
| `/historias/nueva?patient=[id]` | `/pacientes/[id]?tab=soap&action=nueva` |
| `/historias/[id]` | `/pacientes/[id]?tab=soap&record=[id]` |
| `/historias/[id]/editar` | `/pacientes/[id]?tab=soap&record=[id]&mode=edit` |
| `/recetas?patient=[id]` | `/pacientes/[id]?tab=recetas&action=nueva` |
| `/recetas?patient=[id]&tipo=orden` | `/pacientes/[id]?tab=ordenes&action=nueva` |

**Tab alias map** (for bookmarks using old IDs):

```ts
const LEGACY_TAB_ALIASES = {
  evoluciones: "soap",
  historia: "soap",
  hc: "soap",
  vitales: "resumen", // scroll to vitals section
};
```

### 3.3 Shell architecture

```
PatientWorkspaceShell (/pacientes/[id])
├── PatientHeader (identity, coverage, alerts — always visible)
├── PatientWorkspaceTabBar (14 tabs, grouped on mobile)
├── PatientWorkspacePanel (active tab content)
└── PatientWorkspaceSheets (overlay layer — never unmounts shell)
    ├── ConsultSheet      (nueva / ver / editar consulta)
    ├── PrescriptionSheet (nueva receta)
    ├── OrderSheet        (nueva orden)
    ├── UploadSheet       (archivos / estudios)
    └── AllergyVaccineSheet (inline CRUD)
```

Sheets use existing form components (`NuevaConsultaFormBody`, `PrescriptionForm`, etc.) — **reuse, not rewrite**.

### 3.4 Click reduction targets

| Workflow | Today | Target |
|----------|-------|--------|
| Start consult from patient | Sticky bar → `/historias/nueva` → save → `/historias/[id]` | `?tab=soap&action=nueva` sheet → save → stay on tab, record selected |
| Issue prescription | Recetas tab → `/recetas` → save → back | Recetas tab → sheet → save → list refreshes in place |
| View consult | Evoluciones → `/historias/[id]` | SOAP tab → inline detail drawer |
| Edit allergies | Alergias tab → `/editar#perfil-clinico` | Alergias tab → inline edit |
| Agenda → consult | `/historias/nueva?patient&appointment` | `/pacientes/[id]?tab=soap&action=nueva&appointment=[id]` |

**Goal:** 0 full-page navigations during active patient care.

---

## 4. Data Model Changes

### 4.1 Phase A — No DB migration (mapping only)

Map existing `clinical_records` columns to SOAP sections for display:

| SOAP section | Source column |
|--------------|---------------|
| Subjective | `chief_complaint` |
| Objective | *(new optional field or vitals from same record)* |
| Assessment | `diagnosis` |
| Plan | `indications` + `evolution` |

Add read-only SOAP view tab without schema change. AI `soapDraft` output can populate preview.

### 4.2 Phase B — SOAP columns (migration `045_patient_soap_fields.sql`)

```sql
ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS soap_subjective TEXT,
  ADD COLUMN IF NOT EXISTS soap_objective TEXT,
  ADD COLUMN IF NOT EXISTS soap_assessment TEXT,
  ADD COLUMN IF NOT EXISTS soap_plan TEXT;

-- Backfill from legacy columns
UPDATE clinical_records SET
  soap_subjective = chief_complaint,
  soap_assessment = diagnosis,
  soap_plan = COALESCE(indications, evolution)
WHERE soap_subjective IS NULL;
```

Keep `chief_complaint`, `diagnosis`, `evolution`, `indications` **writable in sync** during transition (dual-write in server actions).

### 4.3 Phase C — Structured clinical lists (migration `046_patient_clinical_lists.sql`)

```sql
-- Active problems (ICD-10 optional)
CREATE TABLE patient_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  label TEXT NOT NULL,
  icd10_code TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | resolved | inactive
  onset_date DATE,
  resolved_date DATE,
  source_record_id UUID REFERENCES clinical_records(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Structured allergies
CREATE TABLE patient_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  substance TEXT NOT NULL,
  reaction TEXT,
  severity TEXT, -- mild | moderate | severe
  status TEXT NOT NULL DEFAULT 'active',
  noted_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Structured vaccines (migrate from patients.notes JSON)
CREATE TABLE patient_vaccines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  vaccine_name TEXT NOT NULL,
  dose TEXT,
  administered_at DATE,
  lot_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS: same pattern as `patients` — `clinic_id` tenant boundary.

**Migration script:** import existing `patients.allergies` text and `parsePatientChartExtras().vaccines` into new tables; keep legacy fields as fallback for 2 releases.

### 4.4 Phase D — Interconsultas (future)

Deferred. Placeholder tab stays hidden until spec is defined.

---

## 5. Implementation Phases

### Phase 0 — Plan & design gate ← **YOU ARE HERE**

- [x] Audit current workspace
- [x] Define tab model and URL contract
- [x] Define data migrations
- [ ] **Stakeholder sign-off on tab consolidation** (`evoluciones` → `soap`, hide `vitales` tab)
- [ ] UX wireframes for sheet overlays (optional)

**Exit criteria:** This document approved before any code changes.

---

### Phase 1 — Shell & sheets (no DB changes)

**Goal:** Embed create/view/edit flows inside patient workspace. Zero behavior change for users who still use old URLs (redirects added).

| Task | Files touched |
|------|---------------|
| Create `PatientWorkspaceShell` wrapper | `patient-workspace-view.tsx`, new `patient-workspace-shell.tsx` |
| Create `use-patient-workspace-actions.ts` hook | Parse `?action`, `?record`, `?mode` from URL |
| Create sheet components | `patient-consult-sheet.tsx`, `patient-prescription-sheet.tsx`, `patient-order-sheet.tsx` |
| Wire sticky bar buttons to sheets | `patient-chart-sticky-bar.tsx` |
| Wire ehr panel "Nueva receta/orden" to sheets | `patient-workspace-ehr-panels.tsx` |
| Add legacy URL redirects | `historias/nueva/page.tsx`, `historias/[id]/page.tsx`, `recetas/page.tsx` |
| Update agenda/dashboard links | `appointment-row-actions.tsx`, `clinical-ops-queue-cards.tsx`, etc. |

**Backward compatibility:**

- Old URLs redirect; no 404s.
- `/historias` and `/recetas` clinic-wide lists unchanged.
- `withClinicalHistoryReturn()` deprecated gradually; sheets don't need it.

**Tests:**

- Redirect tests for all legacy URLs
- Sheet open/close from query params
- Save consult from sheet → patient stays on `/pacientes/[id]`

**Risk:** Low. Reuses existing forms.

**Estimated effort:** 3–5 days

---

### Phase 2 — Tab reorganization

**Goal:** Align tab bar to final 14-tab model.

| Task | Detail |
|------|--------|
| Add `soap` tab | New panel: consult list + SOAP detail view (mapped from existing columns) |
| Merge `evoluciones` → `soap` | Redirect `?tab=evoluciones` → `?tab=soap` |
| Demote `vitales` | Vitals grid stays in `resumen`; remove tab or show as sub-section |
| Hide `interconsultas` | Remove from default tab bar until Phase D |
| Enable timeline + audit by default | Remove or default-on feature flags |
| Group tabs on mobile | Primary: Resumen · SOAP · Recetas · Timeline; overflow menu for rest |
| Update manual / command palette | Tab labels and deep links |

**Tests:**

- Tab alias redirects
- Feature flag defaults
- Tab bar ≤14 visible items

**Risk:** Medium (UX change). Mitigate with alias redirects and release notes.

**Estimated effort:** 2–3 days

---

### Phase 3 — SOAP structured fields (DB migration 045)

**Goal:** Real SOAP editor with dedicated columns.

| Task | Detail |
|------|--------|
| Migration `045_patient_soap_fields.sql` | Add columns + backfill |
| Update `createClinicalRecord` / `updateClinicalRecord` | Dual-write legacy + SOAP columns |
| SOAP tab UI | 4-section editor (S/O/A/P) with templates |
| Consult detail drawer | SOAP layout instead of flat fields |
| AI integration | Surface `soapDraft` from clinical assistant into SOAP tab |

**Backward compatibility:**

- Legacy columns remain populated (dual-write).
- Old consult forms still work.
- Export/import unchanged.

**Tests:**

- Backfill migration on staging
- Dual-write round-trip
- Existing consults render in SOAP view

**Risk:** Medium (data). Mitigate with backfill + dual-write for 2 releases.

**Estimated effort:** 3–4 days

---

### Phase 4 — Inline CRUD for allergies, vaccines, attachments

**Goal:** Remove dependency on `/pacientes/[id]/editar` for clinical data entry.

| Task | Detail |
|------|--------|
| Inline allergy editor on `alergias` tab | Edit `patients.allergies` in place (Phase B) |
| Inline vaccine editor on `vacunas` tab | Edit JSON extras in place (Phase B) |
| Inline upload on `archivos` / `estudios` | Reuse `ClinicalDocumentsPanel` upload in sheet |
| Demographics still on `/editar` | Admin fields (DNI, contact) stay on edit page |

**Tests:**

- Save allergy from tab without leaving workspace
- Upload PDF from archivos tab

**Risk:** Low.

**Estimated effort:** 2 days

---

### Phase 5 — Structured problems & allergies (DB migration 046)

**Goal:** EMR-grade problem and allergy lists.

| Task | Detail |
|------|--------|
| Migration `046_patient_clinical_lists.sql` | New tables + RLS |
| Data import script | Migrate free text → structured rows |
| Problem list CRUD | `problemas` tab with add/resolve |
| Allergy list CRUD | Replace free-text with structured entries |
| Vaccine table CRUD | Replace JSON notes |
| Fallback display | Show legacy fields if no structured rows |

**Backward compatibility:**

- `patients.allergies` kept in sync (write-through) for 2 releases.
- `patient-chart-model.ts` reads structured first, falls back to legacy.

**Risk:** Medium-high (data migration). Mitigate with dry-run import on staging + rollback script.

**Estimated effort:** 5–7 days

---

### Phase 6 — Navigation & module deprecation

**Goal:** Sidebar and entry points prioritize patient workspace.

| Task | Detail |
|------|--------|
| Sidebar: "Historia clínica" → patient search or last patients | Link to `/pacientes` with emphasis on opening a record |
| `/historias` becomes clinic-wide consult index | Each row links to `/pacientes/[id]?tab=soap&record=[id]` |
| `/recetas` becomes clinic-wide Rx index | Each row links to `/pacientes/[id]?tab=recetas` |
| Command palette | "Nueva consulta" prompts patient picker → workspace sheet |
| Dashboard cards | All patient actions deep-link to workspace |
| Update `ENTERPRISE_TRANSFORMATION.md` | Phase 21: Patient-centered EMR |
| Update manual (`/ayuda`) | New navigation model |

**Backward compatibility:**

- `/historias` and `/recetas` routes remain; only default CTAs change.
- Bookmarks continue to work via redirects.

**Risk:** Low (mostly link changes).

**Estimated effort:** 2–3 days

---

## 6. Component Map (new / modified)

### New components

```
src/components/pacientes/workspace/
  patient-workspace-shell.tsx
  patient-workspace-action-bar.tsx      ← replaces sticky bar outbound links
  sheets/
    patient-consult-sheet.tsx
    patient-prescription-sheet.tsx
    patient-order-sheet.tsx
    patient-upload-sheet.tsx
  tabs/
    patient-soap-tab.tsx
    patient-soap-consult-list.tsx
    patient-soap-editor.tsx
    patient-allergies-editor.tsx
    patient-vaccines-editor.tsx
```

### New hooks

```
src/lib/hooks/use-patient-workspace-actions.ts   ← URL-driven sheet state
src/lib/hooks/use-patient-soap-tab.ts
src/lib/hooks/use-patient-allergies.ts             ← Phase 5
src/lib/hooks/use-patient-problems.ts              ← Phase 5
```

### Modified (Phase 1–2)

```
src/lib/constants/patient-workspace-tabs.ts
src/components/pacientes/patient-workspace-view.tsx
src/components/pacientes/patient-chart-sticky-bar.tsx
src/components/pacientes/patient-workspace-ehr-panels.tsx
src/app/(dashboard)/historias/nueva/page.tsx       ← redirect
src/app/(dashboard)/historias/[id]/page.tsx        ← redirect
src/app/(dashboard)/recetas/page.tsx               ← redirect when ?patient=
```

---

## 7. Backward Compatibility Matrix

| Concern | Strategy |
|---------|----------|
| Old bookmarks (`?tab=evoluciones`) | Alias redirect to `soap` |
| External links to `/historias/[id]` | 302 → patient workspace |
| API / server actions | No signature changes; dual-write during transition |
| Import/export (HCE CSV) | Unaffected; maps to same tables |
| Portal paciente PWA | Unaffected (separate route tree) |
| PAMI / recetas PDF | Unaffected |
| Tests referencing `/historias/nueva` | Update to new URLs or test redirects |
| Feature flags | Timeline + audit default-on; IA stays plugin-gated |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sheet UX on mobile | Medium | Full-screen sheet on `<md`; test on iOS PWA |
| Dual-write drift (SOAP) | High | Single server action writes both column sets; add integration test |
| Data migration errors (problems/allergies) | High | Dry-run script; keep legacy fields; manual review sample |
| 16→14 tab UX disruption | Medium | Alias redirects; changelog; optional "classic tabs" flag for 1 release |
| Performance (large payload) | Medium | Keep dynamic imports per tab; lazy-load sheets |
| RLS on new tables | High | Copy `patients` RLS pattern; add RLS audit test |
| Regression in consult save | High | E2E: agenda → consult → receta without leaving patient |

---

## 9. Validation Checklist (each phase)

```bash
npm run lint
npm test
npm run build
npx playwright test e2e/patient-workspace.spec.ts   # to be added Phase 1
```

**Manual smoke tests:**

1. Open patient from agenda → start consult in sheet → save → verify SOAP tab
2. Issue prescription from recetas tab → verify no `/recetas` navigation
3. Legacy URL `/historias/nueva?patient=X` → lands in workspace sheet
4. Legacy URL `/historias/[id]` → lands in consult drawer
5. Upload PDF from archivos tab inline
6. Timeline shows new consult after sheet save

---

## 10. Rollback Strategy

| Phase | Rollback |
|-------|----------|
| 1–2 (UI only) | Revert commit; redirects removed |
| 3 (SOAP columns) | Columns nullable; UI reads legacy columns |
| 5 (new tables) | UI reads legacy fields; drop tables only if empty |

Keep feature flag `patient_centered_emr_sheets` for Phase 1–2 to toggle old page navigation if needed.

---

## 11. Recommended Execution Order

```
Phase 0  Plan sign-off          ← current
Phase 1  Sheets + redirects    ← highest ROI, lowest risk
Phase 2  Tab reorganization
Phase 3  SOAP DB + editor
Phase 4  Inline CRUD (allergies/vaccines/upload)
Phase 6  Navigation deprecation (can parallelize with 4)
Phase 5  Structured lists      ← highest effort, do last
```

**Total estimate:** 17–24 dev days across 6 phases.

---

## 12. Decision Points (need confirmation before Phase 1)

1. **`evoluciones` → `soap` merge** — OK to rename tab and redirect?
2. **`vitales` tab removal** — OK to show vitals only inside Resumen + SOAP detail?
3. **`interconsultas`** — hide until spec, or keep placeholder?
4. **Clinic-wide `/historias` and `/recetas`** — keep as secondary indexes, or demote to admin-only?
5. **SOAP DB migration** — Phase 3 now, or stay with column mapping only for v1?
6. **Structured problems/allergies** — Phase 5 now, or defer to v2?

---

## 13. References

- Phase 4 completion: `src/lib/enterprise/phases.ts` (id: `historia-clinica`)
- Tab registry: `src/lib/constants/patient-workspace-tabs.ts`
- Navigation helpers: `src/lib/utils/clinical-navigation.ts`
- Chart model: `src/lib/utils/patient-chart-model.ts`
- Prior refactor: `REFACTOR_REPORT.md` (component size limits apply to new workspace components)
