# Testing — DrFlow (Fase 19)

Estrategia de pruebas enterprise: **90% cobertura** en lógica core (`src/lib`), más integración, RLS, performance, accesibilidad y E2E.

---

## Pirámide de tests

| Capa | Herramienta | Comando |
|------|-------------|---------|
| Unitarios | Vitest | `npm test` |
| Cobertura core lib | Vitest + v8 | `npm run test:coverage` |
| Gate 90% | Script | `npm run check:coverage` |
| Integración RLS | Vitest + Supabase | `npm run test:rls` |
| Performance | Vitest | `npm run test:perf` |
| Accesibilidad | Vitest + manual WCAG | `npm test -- accessibility` |
| E2E smoke | Playwright | `npm run test:e2e` |

---

## Cobertura (90%)

Scope definido en `tests/coverage-scope.ts` → `COVERAGE_INCLUDE`:

- `src/lib/utils`, `permissions`, `security`, `booking`, `validations`
- `src/lib/features`, `observability`, `accessibility`, `jobs` (registry/enqueue)
- `src/plugins`, `app-release`, `qa`

**Excluido** (integración / server-only): `src/lib/actions`, `src/lib/supabase`, `src/lib/server`, handlers de jobs.

Umbrales CI:

- Lines / statements: **90%**
- Functions: **85%**
- Branches: **75%**

Reporte HTML: `coverage/index.html`

---

## RLS

### Estático (siempre)

`tests/rls-policies.test.ts` — manifest vs migraciones SQL.

`tests/phase19-infrastructure.test.ts` — tablas enterprise 049–052.

### Integración (opcional)

Requiere `.env.local` con service role:

```powershell
$env:DRFLOW_RLS_INTEGRATION="1"
npm run test:rls
```

---

## E2E (Playwright)

```powershell
npm run build
npm run test:e2e
```

Smoke tests (`e2e/smoke.spec.ts`):

- Login page
- `/privacidad`
- `/api/health` JSON
- `/api/version` JSON

Playwright levanta `next start` automáticamente (salvo `PLAYWRIGHT_SKIP_WEBSERVER=1`).

---

## Performance

`tests/performance/critical-utils.perf.test.ts` — benchmarks de parseo CSV y búsqueda en paleta de comandos (umbrales en ms).

---

## CI/CD

`.github/workflows/ci.yml`:

1. lint → test → build → smoke health
2. **coverage gate** (`npm run check:coverage`)
3. **E2E** Playwright (Chromium)
4. docker build

---

## Checklist pre-merge

```powershell
npm test
npm run check:coverage
npm run test:perf
npm run build
npm run test:e2e
```

Ver también: [PRODUCTION.md](./PRODUCTION.md)
