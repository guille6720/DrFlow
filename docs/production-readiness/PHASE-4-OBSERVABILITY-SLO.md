# Phase 4 — Observability + SLO Hardening

**Repository:** [guille6720/DrFlow](https://github.com/guille6720/DrFlow)  
**Branch:** `release/0.2.19-staging-promotion`  
**Scope:** Staging-first; production not modified directly  
**Report date:** 2026-08-28  
**References:** [PHASE-1-BASELINE.md](./PHASE-1-BASELINE.md), [DATABASE-SCALE-REPORT.md](./DATABASE-SCALE-REPORT.md), [PHASE-3-TENANT-ISOLATION.md](./PHASE-3-TENANT-ISOLATION.md)

---

## Executive summary

Phase 4 hardens DrFlow observability for incident diagnosis **without sending PHI to third parties**. Existing Phase 16 infrastructure (`clinic_observability_events`, trace IDs, health probes) was reused and extended — not duplicated. Central PHI sanitization now wraps **structured logs, observability persistence, client ingest, and Sentry `beforeSend`**. User-facing errors expose safe correlation references (`DF-XXXXXX`). Initial SLI/SLO targets and alert matrix are documented for staging validation before the 1,000-user load test.

| Exit criterion | Status |
|----------------|--------|
| Critical errors externally observable (Sentry) | ✅ Wired + staging/preview enabled |
| PHI excluded from external telemetry | ✅ Tests + centralized redaction |
| Correlation IDs on critical flows | ✅ Middleware + persist route + action boundary |
| Latency measurable on important operations | ✅ Thresholds + clinical persist instrumented |
| Health checks safe | ✅ Verified (no secrets in responses) |
| Initial SLO/SLI + alerts documented | ✅ |
| No new security regression | ✅ Security gate green |
| Build/tests pass | ✅ |

**Phase 4 verdict:** **GO** to Phase 5, pending Sentry DSN configuration on staging/preview deployments and k6-based SLO validation (Phase 7).

---

## 1. Existing observability inventory (pre-Phase 4)

| Capability | Location | Notes |
|------------|----------|-------|
| Trace IDs | `src/core/observability/trace-id.ts`, `middleware.ts` | `x-drflow-trace-id` header |
| Structured events DB | `clinic_observability_events` (migration 052) | 30-day purge cron |
| `recordObservabilityEvent` | `src/core/observability/record.ts` | Fire-and-forget persistence |
| API timing wrapper | `withObservabilityApiRoute` | ~8 routes |
| Query timing | `observeQuery` | Dashboard, pacientes, observability panel |
| Client Web Vitals | `performance-monitor.tsx` → `/api/observability/events` | Batched ingest |
| Health | `/api/health`, `/live`, `/ready`, `/version` | `health.ts` probes |
| Uptime CI | `.github/workflows/uptime.yml` | 15 min cron |
| Sentry (optional) | `sentry.client.ts`, `sentry.server.ts` | DSN-gated; was production-only |
| PHI sanitizer (partial) | `sanitize-monitoring-payload.ts` | Used only in health cron |
| Clinical audit (separate) | `audit_logs`, `clinical_record_audit` | Immutable compliance trail |
| pg_stat staging | Phase 2 `staging-query-performance.mjs` | Documented in DATABASE-SCALE-REPORT |

**Avoided duplication:** No second APM layer; extended existing modules.

---

## 2. Changes made

| Change | Files | Purpose |
|--------|-------|---------|
| Central PHI redaction pipeline | `sanitize-monitoring-payload.ts` | All telemetry paths |
| Structured JSON logs | `structured-log.ts`, `log-error.server.ts` | Operational vs audit separation |
| User correlation reference | `correlation-id.ts`, `safe-error.server.ts` | `DF-XXXXXX` in user errors |
| Operation thresholds | `operation-thresholds.ts` | Read/write warn/critical ms |
| Critical op wrapper | `observe-critical-operation.ts` | Reuses `withObservabilityTiming` |
| Sentry hardening | `sentry.server.ts`, `sentry.client.ts` | `beforeSend`, release SHA, preview/staging enable, unhandled rejections (client) |
| Clinical persist observability | `api/clinical-records/persist/route.ts` | Timing + safe error + `logServerError` |
| Client ingest sanitization | `api/observability/events/route.ts` | Server-side metadata scrub |
| Action boundary trace | `action-boundary.server.ts` | Propagate trace to errors |
| Record metadata scrub | `record.ts` | DB events sanitized |
| Security gate allowlist | `manual-image.tsx` documented P2 safe | Static SVG only |
| Tests | `tests/observability-phase4.test.ts` | PHI, correlation, wiring |

---

## 3. Sentry status

| Aspect | Configuration |
|--------|---------------|
| Server DSN | `SENTRY_DSN` |
| Client DSN | `NEXT_PUBLIC_SENTRY_DSN` |
| Enabled when | DSN set AND (`production` OR `preview` OR `DRFLOW_SENTRY_STAGING=1`) |
| Release tag | `drflow@{buildId}` from git SHA / app version |
| Tags | `drflow.scope`, `drflow.path`, `drflow.trace_id`, `drflow.clinic_id`, `drflow.release` |
| PHI | `beforeSend` → `sanitizeSentryEventInPlace` |
| Traces | Server 10% prod; client 0% |
| Staging | Set `DRFLOW_SENTRY_STAGING=1` + DSN on preview/staging deploy |

**Not implemented (deferred):** Edge/middleware Sentry, `@sentry/nextjs` official wrapper.

---

## 4. PHI redaction strategy

**Blocked key patterns (sample):** `password`, `token`, `dni`, `document_number`, `chief_complaint`, `diagnosis`, `evolution`, `prescription`, `medications`, `email`, `phone`, `first_name`, `last_name`, …

**Blocked value patterns:** JWT/Bearer tokens, Postgres URLs, email-like strings.

**Applied at:**

1. `logServerError` / `logClientError` metadata
2. `recordObservabilityEvent` insert payload
3. Client observability ingest (server-side)
4. Sentry `beforeSend`
5. Structured operational logs (`emitStructuredLog`)

**Never sent:** patient names, DNI, SOAP, diagnoses, prescriptions, raw request bodies, Supabase row payloads.

**Regression tests:** `tests/observability-phase4.test.ts` (16 cases).

---

## 5. Trace / correlation strategy

```
Browser/request → middleware (x-drflow-trace-id)
                → server action / API route (getRequestTraceId)
                → logServerError / recordObservabilityEvent / Sentry tag
                → user error: "Referencia: DF-{last6hex}"
```

Example user message: `No se pudo guardar la consulta. Referencia: DF-CDEF01.`

Stack traces and internal details are **not** shown to users.

---

## 6. Critical operations instrumented

| Operation | Instrumentation | Threshold kind |
|-----------|-----------------|----------------|
| `dashboard.load` | Existing `observeQuery` on dashboard loaders | read |
| `patient.search` | Existing loaders / API | read |
| `patient.workspace` | Existing pacientes loader | read |
| `clinical.history` | Existing EHR loaders | read |
| **`clinical.consultation.save`** | **NEW** `observeCriticalOperation` on persist API | write |
| `clinical.soap.save` | Same persist path (SOAP fields) | write |
| `prescription.save` | Existing action patterns (extend in Phase 5/7) | write |
| `bulk.export` | Phase 2 concurrency (timing via jobs TBD) | write |
| `auth.session` | Middleware + auth routes | read |

**Initial thresholds (observability, not final SLO):**

| Kind | Warn | Critical |
|------|------|----------|
| READ | 1000 ms | 2000 ms |
| WRITE | 1500 ms | 3000 ms |

Legacy Phase 16 thresholds remain for query/API categories (`SLOW_QUERY_MS=500`, `SLOW_REQUEST_MS=2000`).

---

## 7. SLI definitions

| SLI | Measurement | Source |
|-----|-------------|--------|
| **Availability** | `% successful /api/health/ready` probes | Uptime workflow + Vercel cron |
| **Latency (normal read)** | p95 duration of read operations | `clinic_observability_events` |
| **Latency (critical read)** | p95 patient workspace / clinical history | observability events |
| **Latency (critical write)** | p95 clinical persist | `clinical.consultation.save` events |
| **HTTP error rate** | 5xx / total authenticated API | Sentry + observability `category=error` |
| **Clinical save reliability** | successful persist / attempts | persist route + observability |
| **Auth reliability** | successful session bootstrap / attempts | auth routes + health |

---

## 8. SLO targets (initial staging — adjust after k6)

| SLO | Target | Status |
|-----|--------|--------|
| Availability | ≥ 99.9% | Documented; measure via uptime |
| Normal read p95 | < 1000 ms | Initial target |
| Critical read p95 | < 1500 ms | Initial target |
| Critical write p95 | < 2000 ms | Initial target |
| HTTP error rate | < 1% | Initial target |
| Clinical mutation success | ≥ 99.9% | Initial target |

**Error budget:** At 99.9% monthly availability, ~43 minutes downtime/month budget. Not claimed as production-compliant until measured.

---

## 9. Alert matrix

| Severity | Trigger | Owner action | First diagnostic step |
|----------|---------|--------------|------------------------|
| **P0** | Clinical save failure spike (`clinical.persist` errors) | On-call dev | Check Sentry + `clinic_observability_events` by trace_id |
| **P0** | `/api/health/ready` failing | Infra | Supabase connectivity, env validation |
| **P0** | Auth outage (401/403 spike on dashboard) | On-call dev | Supabase Auth status, session middleware |
| **P0** | Widespread 5xx | On-call dev | Recent deploy SHA, Sentry release |
| **P0** | Cross-tenant anomaly (if detectable) | Security | Run Phase 3 staging probes |
| **P1** | p95 latency breach (observability warn/critical) | Performance | pg_stat top queries (Phase 2 script) |
| **P1** | Increased 429 | Infra | Rate limit config, traffic source |
| **P1** | Connection pressure | DBA | Supabase dashboard metrics |
| **P1** | Slow query regression | DBA | `node scripts/staging-query-performance.mjs` |
| **P1** | Background job failures | Dev | `/api/jobs/process` logs |
| **P2** | Isolated frontend exceptions | Dev | Sentry issue triage |
| **P2** | Non-critical route degradation | Dev | Observability panel in configuración |

**Note:** `OPS_ALERT_WEBHOOK_URL` is defined in renapdis readiness but webhook dispatch is **not wired** — alerts are documented for manual/Phase 5 integration.

---

## 10. Health endpoint validation

| Endpoint | Validates | Secrets exposed |
|----------|-----------|-----------------|
| `/api/health/live` | Process alive | None |
| `/api/health/ready` | Supabase, memory, schema, prod env | None |
| `/api/health` | Composite + optional persist | None |
| `/api/version` | App version, buildId, changelog highlights | None |

Smoke: `npm run check:health`

---

## 11. Supabase / database visibility (Phase 2 integration)

**Staging procedure:**

```bash
node scripts/staging-query-performance.mjs
```

Monitor: top total time, top mean time, top calls, EXPLAIN on synthetic clinic.

Documented in [DATABASE-SCALE-REPORT.md](./DATABASE-SCALE-REPORT.md). No credentials in repo or reports.

---

## 12. Tests executed

| Check | Result |
|-------|--------|
| `tests/observability-phase4.test.ts` | ✅ 16/16 |
| `tests/xss-audit.test.ts` | ✅ 6/6 |
| `npm run security:gate` | ✅ Pass |
| `npm run typecheck` | ✅ Pass |
| `npm run test:rls:static` | ✅ 23/23 |
| `npm run performance:gate` | ✅ 106/106 |
| `npm run build` | ✅ Pass |

---

## 13. Security gate — `dangerouslySetInnerHTML` conclusion

| File | Classification | Rationale |
|------|----------------|-----------|
| `manual-image.tsx` | **P2 — Safe (allowlisted)** | Renders **static compile-time SVG** from `MANUAL_ILLUSTRATION_MARKUP` map. Superadmin-only manual. No user/PHI input. No `<script>`. |
| `testing-campaign.ts` | **N/A — meta string** | Contains pattern name in test catalog text only; excluded from gate scan. |
| Theme/marketing scripts | **P2 — Safe (existing allowlist)** | Bootstrap/theme/JSON-LD only. |

**Not exploitable** under current architecture. Regression guards: `xss-audit.test.ts`, `security-gate.mjs` allowlist, `observability-phase4.test.ts` static markup check.

---

## 14. Remaining P0 / P1

### P0 (unchanged)

| ID | Finding |
|----|---------|
| BL-P0-1 | No k6/load test for 1,000 users |
| BL-P0-2 | RPO ≤ 1 h not proven |

### P1

| ID | Finding | Status after Phase 4 |
|----|---------|----------------------|
| BL-P1-1 | Warm nav latency | Open — measure in Phase 7 |
| OBS-3 | Sentry not verified on staging deploy | Mitigated — enable via `DRFLOW_SENTRY_STAGING=1` |
| ERR-3 | Clinical save alert webhook | Documented; wire in Phase 5 |
| OPS webhook | `OPS_ALERT_WEBHOOK_URL` not dispatched | P1 — Phase 5 |

---

## Phase 5 GO / NO-GO

**Decision: GO** — Observability foundation is sufficient to diagnose staging incidents and support the upcoming load test. Configure Sentry DSN on staging preview, wire alert webhooks in Phase 5, and validate SLOs with k6 in Phase 7 before production capacity claims.
