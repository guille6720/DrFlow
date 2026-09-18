# ReNaPDiS SLA / SLO — availability (staging readiness)

**Status:** target configured / measurement ready.  
**Does not claim** that 99.8% monthly availability has already been achieved.

## SLI

```text
successful_health_checks / total_health_checks
```

Primary probe: `GET /api/health/ready` → HTTP 200 and JSON `ok: true`.

Secondary: `GET /api/health/live` (liveness only; process up).

## SLO

| Metric | Target |
|--------|--------|
| Monthly availability | ≥ **99.8%** |

## Measurement method

1. GitHub Actions workflow `.github/workflows/uptime.yml` (scheduled probes).
2. Optional external uptime monitor pointing at staging/fiscalization URLs.
3. Persist samples via `/api/health?persist=1` (cron-authenticated) into `clinic_observability_events` when configured.

## Outage definition

An **outage minute** is any minute where readiness probes fail (HTTP ≠ 200 or `ok: false`) for the monitored environment.

## Exclusions

- Planned maintenance windows announced in advance
- Dependency failures solely attributable to upstream provider regional incidents **may** be annotated separately (still recorded; reporting can distinguish)
- Local developer machines are **not** part of the SLI

## Planned maintenance

Document window, owner, start/end UTC-3, and exclude from monthly SLO denominator only when pre-announced.

## Reporting

Monthly: compute SLI from probe logs; attach evidence (workflow runs, observability events). Until ≥30 days of samples exist, report: **measurement ready — insufficient history**.
