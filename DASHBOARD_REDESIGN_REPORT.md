# Dashboard Redesign Report — Clinical Operations Center

**Date:** 2026-07-30  
**Scope:** `/dashboard` → Clinical Operations Center  
**Quality gate:** `npm run quality:gate:fast` ✅ · `npm run build` ✅

---

## 1. Files modified / added

### New files

| File | Purpose |
|------|---------|
| `src/lib/utils/clinical-ops-metrics.ts` | Pure metrics: activity KPIs, waiting enrichment, lab prioritization, actionable alerts |
| `src/components/dashboard/clinical-ops-center/clinical-ops-center.tsx` | Main 3-column layout orchestrator |
| `src/components/dashboard/clinical-ops-center/clinical-ops-realtime.tsx` | Supabase realtime + 30s poll refresh |
| `src/components/dashboard/clinical-ops-center/clinical-ops-top-bar.tsx` | Live clock, professional, clinic, search, notifications |
| `src/components/dashboard/clinical-ops-center/clinical-ops-left-rail.tsx` | Section navigation + quick links |
| `src/components/dashboard/clinical-ops-center/clinical-ops-main-sections.tsx` | Main panel section composer |
| `src/components/dashboard/clinical-ops-center/clinical-ops-activity-strip.tsx` | Section 1 — Today's activity KPIs |
| `src/components/dashboard/clinical-ops-center/clinical-ops-queue-sections.tsx` | Sections 2 & 3 — Waiting queue + critical alerts |
| `src/components/dashboard/clinical-ops-center/clinical-ops-worklist-sections.tsx` | Sections 4, 5 & 6 — Rx, orders, labs |
| `src/components/dashboard/clinical-ops-center/clinical-ops-tasks-sections.tsx` | Sections 7, schedule, notifications |
| `src/components/dashboard/clinical-ops-center/clinical-ops-ai-rail.tsx` | Right sidebar AI (lazy-loaded inner) |
| `src/components/dashboard/clinical-ops-center/clinical-ops-ai-rail-inner.tsx` | Rule-based clinical summary (no autonomous decisions) |
| `src/components/dashboard/clinical-ops-center/clinical-ops-quick-actions.tsx` | Dashboard FAB (clinical quick actions) |
| `src/components/dashboard/clinical-ops-center/clinical-ops-shared.tsx` | Shared UI: avatars, section headers, priority badges |
| `src/components/dashboard/clinical-ops-center/use-completed-tasks.ts` | Task completion state (localStorage, per day) |
| `tests/clinical-ops-metrics.test.ts` | Unit tests for metrics layer |

### Modified files

| File | Change |
|------|--------|
| `src/lib/utils/clinical-operations-types.ts` | Extended types for enriched waiting, activity, orders, labs, alerts |
| `src/lib/utils/clinical-operations-dashboard-types.ts` | Extended dashboard payload |
| `src/lib/server/load-clinical-operations-dashboard.ts` | Parallel fetch: medical orders, medications, birth_date, metrics |
| `src/components/dashboard/clinical-operations-dashboard.tsx` | Re-exports `ClinicalOpsCenter` |
| `src/app/(dashboard)/dashboard/page.tsx` | Passes clinicId, clinicName, professionalName |

---

## 2. UX decisions

| Decision | Rationale |
|----------|-----------|
| **3-column grid** (left nav · main · AI rail) | Answers “what next?” without scrolling; desktop-first for physicians |
| **Activity strip first** | 5-second scan: waiting, attended, avg wait, next appt, delayed |
| **Rich waiting cards** | Photo initials, age, priority, allergies, reason, one-click consult start |
| **Actionable alerts only** | No decorative noise — allergies, delays, urgent queue |
| **Left FAB for quick actions** | Avoids collision with admin ops copilot (bottom-right) |
| **Task completion via checkbox** | Reduces cognitive load; persisted locally per day (no new DB table) |
| **AI rail = rule-based summary** | Reminders and follow-ups from ops data; copilot opens on demand with physician confirmation |
| **Anchor navigation in left rail** | Jump to queue, alerts, tasks without losing context |
| **Mobile/tablet** | Left rail hidden `<lg`; AI rail hidden `<xl`; main panel stacks full-width |

---

## 3. Performance improvements

- **Single parallel SSR fetch** extended (not sequential) — appointments, Rx, studies, reminders, orders in one `Promise.all`
- **Realtime refresh** on `appointments`, `prescription_drafts`, `medical_orders` instead of full-page polling only
- **Lazy-loaded AI rail inner** via `next/dynamic` (`ssr: false`) — secondary widget deferred on client
- **Pure metrics module** — no React in compute path; testable and tree-shakeable
- **No decorative charts** — zero chart library cost on dashboard
- **Component split** — all files ≤350 lines (architecture gate)

---

## 4. Removed elements

| Removed | Notes |
|---------|-------|
| Flat 3-card grid layout | Replaced by operational sections |
| Generic “Operaciones clínicas” subtitle row | Replaced by ops top bar + activity strip |
| Minimal waiting list (name + time only) | Replaced by enriched queue cards |
| Standalone notifications card at bottom | Integrated as section; count in top bar |
| Dashboard FAB suppression | Clinical quick actions now enabled on `/dashboard` |
| Unused `upcoming` rendering gap | Data still loaded for copilot bridge; next appointment surfaced in KPIs |

*Revenue graphs and monthly statistics were already on `/reportes` — not on dashboard.*

---

## 5. Added functionality

- **Today's activity metrics:** waiting count, attended, average wait, next appointment, delayed count
- **Enriched waiting queue:** age, priority, allergies, visit reason (notes), alerts, action buttons
- **Pending medical orders** (`medical_orders` status `draft`)
- **Prescription medication summary** from `medications` JSONB
- **Lab results section** with filename-based lab detection and review prioritization
- **Urgent patients** derived from priority scoring
- **Actionable critical alerts** merged from allergies, delays, urgent queue
- **Task mark-complete** with local persistence
- **Realtime updates** for queue, Rx, orders
- **Clinical quick actions FAB:** new patient, appointment, search (Ctrl+K), Rx, SOAP, order
- **AI assistant rail:** day summary, reminders, suggested follow-ups, pending documentation

---

## 6. Accessibility improvements

- `aria-label` on main region, ops top bar, left rail, AI rail, FAB menu
- **Keyboard focus rings** on nav links, task complete buttons, FAB
- **Semantic sections** with `aria-labelledby` via `OpsSection`
- **Live time** exposed with `<time dateTime="…">`
- **Screen reader labels** on icon-only buttons (complete task, FAB toggle)
- **WCAG AA contrast** maintained on dark clinical theme (amber/red/teal semantic tones)

---

## 7. Future recommendations

1. **Structured lab results** — Parse PDF/OCR or HL7/FHIR feeds to flag abnormal values (currently filename-heuristic)
2. **Server-side task completion** — Persist task state in DB for multi-device staff
3. **Patient photos** — Use `avatar_url` or clinic-uploaded photo when available
4. **Print/Send on Rx cards** — Wire to existing prescription issue flow when draft ID is addressable
5. **Tablet-optimized left rail** — Collapsible drawer instead of hidden nav
6. **Performance telemetry** — RUM for dashboard TTFB and LCP (<2s target)
7. **Authorization-aware filtering** — Show only current professional's queue when role = physician

---

## Validation checklist

| Check | Result |
|-------|--------|
| ESLint | ✅ |
| TypeScript | ✅ |
| Tests (459 passed) | ✅ |
| Production build | ✅ |
| Architecture gate (≤350 lines/component) | ✅ |
| Responsive layout (lg/xl breakpoints) | ✅ |

---

*The dashboard is now a Clinical Operations Center focused on daily physician and reception workflow — speed, decisions, and minimal clicks over decoration.*
