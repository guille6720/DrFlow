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
- Branches: **70%**

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
- Patient workspace redirect to login (sin sesión)
- `/privacidad`
- `/api/health` JSON
- `/api/version` JSON

### Recetas (autenticado, opcional)

`e2e/prescription-wizard.spec.ts` — login → workspace paciente → wizard 3 pasos → guardar borrador (o emitir con `E2E_ISSUE_RX=1`).

Requiere Supabase real en el servidor de prueba y variables:

```powershell
$env:E2E_EMAIL="medico@clinica.com"
$env:E2E_PASSWORD="********"
$env:E2E_PATIENT_ID="uuid-del-paciente"
# Opcional PAMI:
$env:E2E_INSURANCE_NUMBER="12345678901"
# Emitir en lugar de borrador:
$env:E2E_ISSUE_RX="1"

# Usar el mismo proyecto Supabase que la app:
$env:NEXT_PUBLIC_SUPABASE_URL="https://....supabase.co"
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="eyJ..."

npm run build
npm run test:e2e
```

Sin credenciales E2E, el spec de recetas se **omite** y CI sigue pasando solo con smoke.

### Auth (autenticado, opcional)

`e2e/auth.spec.ts` — login UI → `/dashboard`.

Requiere `E2E_EMAIL` y `E2E_PASSWORD` (mismas credenciales que recetas).

### Reserva pública (opcional)

`e2e/public-booking.spec.ts` — carga `/solicitar-turno/{slug}`, elige profesional y verifica la sección de horarios.

```powershell
$env:E2E_BOOKING_SLUG="consultorio-dr-castro"
npm run test:e2e
```

Sin slug activo, el spec se **omite**.

### Atender ahora (autenticado, opcional)

`e2e/attend-now.spec.ts` — login → ficha paciente → **Iniciar consulta** → formulario SOAP.

Requiere las mismas credenciales que recetas (`E2E_EMAIL`, `E2E_PASSWORD`, `E2E_PATIENT_ID`).

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
