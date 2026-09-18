# ReNaPDiS DR drill checklist

Reusable template. **Do not fabricate completed drills.**

## Header

| Field | Value |
|-------|-------|
| Date | |
| Environment | staging / fiscalization (never overwrite active staging) |
| Scenario | A–G (see DISASTER_RECOVERY.md) |
| Facilitator | |
| Observers | |

## Timeline

| Milestone | Timestamp (UTC-3) |
|-----------|-------------------|
| Start | |
| Detection | |
| Restore start | |
| Restore completed | |
| Service validated | |

## Measurements

| Metric | Value |
|--------|-------|
| Measured RTO | |
| Measured RPO (data lag) | |
| Target RTO | < 2 hours |
| Target RPO | < 30 minutes |

## Validation

- [ ] `/api/health/live` 200
- [ ] `/api/health/ready` 200
- [ ] Login (fiscalization or staging test user)
- [ ] Synthetic patient visible in fiscalization clinic only
- [ ] Local prescription smoke
- [ ] National submit blocked/outage behavior as expected
- [ ] No production project touched

## Issues found

1.

## Corrective actions

1.

## Cadence

Prepare for **at least two documented DR exercises per year**.
