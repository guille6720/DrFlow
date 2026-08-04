## Summary

<!-- What changed and why (1–3 sentences) -->

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Database migration
- [ ] Documentation / ops
- [ ] Security fix

## Definition of Done — mandatory

### Automated (CI must pass)

- [ ] `quality-gate` CI job green
- [ ] TypeScript zero errors (`npm run typecheck`)
- [ ] ESLint zero warnings (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Core coverage ≥ 90% (`npm run check:coverage`)
- [ ] Critical coverage ≥ 95% (`npm run check:critical-coverage`)
- [ ] Security gate (`npm run security:gate`)
- [ ] Architecture gate (`npm run architecture:gate`)
- [ ] Performance gate (`npm run performance:gate`)
- [ ] Production build succeeds (`npm run build`)

### Code quality

- [ ] No `TODO` / `FIXME` / `eslint-disable` / unsafe `any`
- [ ] No `console.log` in `src/` (use `devLog` or structured logging)
- [ ] No unused imports or dead code
- [ ] No duplicated logic

### Architecture

- [ ] Business logic not in UI components (hooks / actions / utils)
- [ ] SOLID / DRY / feature-based structure followed
- [ ] Components ≤ 350 lines (target ≤ 250)
- [ ] Architecture reviewed

### Tests

- [ ] Unit tests added or updated
- [ ] Integration tests updated (if API / RLS / server actions changed)
- [ ] RLS manifest updated (if new tables)

### Security

- [ ] Auth / authz unchanged or improved
- [ ] Clinic / organization scoping verified
- [ ] No secrets, XSS, or unsafe uploads introduced
- [ ] Security reviewed

### Performance

- [ ] No N+1 queries or request waterfalls
- [ ] No unnecessary re-renders
- [ ] Lazy loading / Suspense where appropriate
- [ ] Performance reviewed (unchanged or improved)

### UX / accessibility

- [ ] Loading, empty, and error states implemented
- [ ] Responsive behavior verified
- [ ] Accessibility preserved (labels, focus, contrast)

### Medical software (EMR)

- [ ] Patient safety — no unconfirmed clinical actions
- [ ] Audit trail for sensitive changes (`logAudit`)
- [ ] Data integrity — no silent data loss
- [ ] AI output requires physician confirmation (if applicable)
- [ ] Clinical workflow consistency maintained

### Documentation & release

- [ ] Documentation updated (if behavior changed)
- [ ] `.env.example` updated (if new env vars)
- [ ] Migration documented (if SQL)
- [ ] Rollback documented (if migration or breaking change)
- [ ] Backward compatibility verified
- [ ] No breaking changes (or explicitly approved)

## Test plan

<!-- Steps reviewers can follow to validate -->

1.
2.
3.

## Screenshots / recordings

<!-- If UI changes -->

## Migration notes

<!-- SQL migration number, apply order, rollback plan -->

## Related issues / docs

<!-- Links -->
