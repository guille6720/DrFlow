# Enterprise Transformation — DrFlow

Plan de 20 fases para convertir DrFlow en software **enterprise-grade** orientado a velocidad del médico.  
**Estado:** ✅ **Roadmap completado** (Fases 1–20) + Hardening v1.0 · **HEAD:** `d31afcc` · **Versión:** 0.2.1

---

## Regla rectora

> ¿Hace que el médico trabaje más rápido?

Cada fase es incremental: sin romper compatibilidad, sin eliminar funcionalidades existentes.

---

## Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| Fases completadas | 19 implementación + 1 auditoría + 1 cierre doc |
| Migraciones enterprise | `046`–`052` |
| Tests Vitest | 291+ |
| Cobertura core lib | ≥90% (gate CI) |
| E2E smoke | Playwright (`e2e/smoke.spec.ts`) |
| Prod | [drflow.opusorg.com](https://drflow.opusorg.com) · Vercel `gru1` |

---

## Índice de fases

| # | Fase | Commit(s) clave | Doc / artefacto |
|---|------|-----------------|-----------------|
| 1 | Auditoría automática | — (solo lectura) | [AUDITORIA.md](../AUDITORIA.md) |
| 2 | Refactor god components | `922d7de` … `a0d0350` | splits patient-chart, ehr, intake, recetas |
| 3 | Modularización | `1909d14` | `src/features/` |
| 4 | HC centrada en paciente | `ac34ea1` | tabs workspace |
| 5 | Centro operaciones clínicas | `2f06295` | dashboard ops |
| 6 | UX / command palette | `560156a` | Ctrl+K |
| 7 | Asistente clínico IA | `ab67040` | clinical-assistant |
| 8 | Timeline unificada | `d5d093b` | build-clinical-timeline |
| 9 | Performance | `2e1e002` | migr. `046`, React Compiler |
| 10 | Seguridad | `008da77` | migr. `047` |
| 11 | Multi-tenant | `dbb3d9d` | tenant-scope |
| 12 | Auditoría clínica | `23be50f` | migr. `048` |
| 13 | Plugins | `49d2790` | migr. `049` |
| 14 | Feature flags | `10d18db` | migr. `050` |
| 15 | Cola de trabajos | `20b8dfc`, `ed92c79` | migr. `051` |
| 16 | Observabilidad | `9b252e9` | migr. `052`, `/api/health` |
| 17 | Accesibilidad WCAG AA | `63cfc6b` | skip link, config panel |
| 18 | Producción | `4603631`, `306447f` | [PRODUCTION.md](./PRODUCTION.md) |
| 19 | Testing 90% | `fa0147f` | [TESTING.md](./TESTING.md) |
| 20 | Cierre roadmap | *(este doc)* | `src/lib/enterprise/phases.ts` |

Registro machine-readable: `src/lib/enterprise/phases.ts`

---

## Detalle por fase

### Fase 1 — Auditoría automática

**Qué se hizo:** Análisis read-only de arquitectura, god components, OWASP, RLS, duplicación.  
**Entregable:** Informe con scores y backlog priorizado.  
**Decisión:** No tocar código hasta tener mapa de deuda — evita refactors ciegos.

### Fase 2 — Refactorización

**Qué se hizo:** `patient-chart-view` 682→63 líneas; splits de EHR, intake profesional, hub recetas.  
**Decisión:** Orquestadores delgados + hooks/utils tipados; tests por módulo.

### Fase 3 — Modularización

**Qué se hizo:** `src/features/*` con barrels; registry compartido; nav por feature.  
**Decisión:** Capa vertical sobre capas horizontales (`components/`, `lib/`).

### Fase 4 — Historia clínica

**Qué se hizo:** 16 tabs en `/pacientes/[id]`; redirect legacy `/historias/paciente`.  
**Decisión:** El paciente es el centro — no módulos sueltos de HC.

### Fase 5 — Dashboard operativo

**Qué se hizo:** Centro de operaciones: sala de espera, turnos, strip de flujo.  
**Decisión:** Menos gráficos decorativos, más señales accionables.

### Fase 6 — UX

**Qué se hizo:** Command palette, prefetch de rutas, FAB contextual.  
**Decisión:** 2 clics para paciente, 1 para nueva evolución vía atajos.

### Fase 7 — IA integrada

**Qué se hizo:** Asistente en consulta: CIE-10, alertas, borradores SOAP.  
**Decisión:** IA en flujo clínico, no menú aparte.

### Fase 8 — Timeline

**Qué se hizo:** Timeline unificada consultas + labs + recetas + adjuntos.  
**Decisión:** Una sola línea temporal filtrable por categoría.

### Fase 9 — Performance

**Qué se hizo:** React Compiler, loaders unificados, Suspense, índices `046`.  
**Decisión:** Medir en loader único por pantalla de paciente.

### Fase 10 — Seguridad

**Qué se hizo:** Hardening RLS, CSRF en auth, PHI isolation, trial RLS `047`.  
**Decisión:** Defense in depth: RLS + server guards + CSRF.

### Fase 11 — Multi-tenant

**Qué se hizo:** `assertSameClinic`, filtros `clinic_id` en actions sensibles.  
**Decisión:** `clinic_id` como tenant boundary (no organization_id — ya existía en schema).

### Fase 12 — Auditoría clínica

**Qué se hizo:** `audit_logs` con patient_id, old/new values; tab auditoría en paciente.  
**Decisión:** Inmutable append-only para trazabilidad legal.

### Fase 13 — Plugins

**Qué se hizo:** `clinic_plugins`, nav filtrada, panel configuración.  
**Decisión:** Desactivar PAMI/voz/etc. sin redeploy.

### Fase 14 — Feature flags

**Qué se hizo:** `clinic_feature_flags`, 8 flags, runtime toggles.  
**Decisión:** Granularidad dentro del plugin activo.

### Fase 15 — Cola de trabajos

**Qué se hizo:** `clinic_jobs`, worker cron, emails/PDF/import async.  
**Decisión:** UI responde al instante; worker con `after()` + Vercel cron.

### Fase 16 — Observabilidad

**Qué se hizo:** Eventos estructurados, `/api/health`, trace ID, purge 30d.  
**Decisión:** Telemetría propia en Supabase antes que SaaS externo.

### Fase 17 — Accesibilidad

**Qué se hizo:** WCAG AA base: skip link, focus-visible, landmarks, panel config.  
**Decisión:** Incremental — contraste parcial documentado como backlog.

### Fase 18 — Producción

**Qué se hizo:** Dockerfile, CI smoke, backup script, uptime workflow.  
**Decisión:** Vercel sigue prod; Docker = self-hosted opcional.

### Fase 19 — Testing

**Qué se hizo:** Gate 90% core lib, Playwright smoke, perf benchmarks, RLS estático.  
**Decisión:** Scope acotado en `tests/coverage-scope.ts` — actions/server en integración futura.

### Fase 20 — Cierre del roadmap

**Qué se hizo:** Este documento + registro `phases.ts` + validación en CI.  
**Protocolo por fase (meta):**

1. Explicar qué se hizo  
2. Archivos / commits de referencia  
3. Justificar decisiones  
4. `npm test` + `npm run build`  
5. Corregir errores  
6. Commit lógico por fase  
7. Migración remota si aplica (`npx supabase db query --linked -f …`)

---

## Migraciones enterprise (046–052)

| Migración | Fase | Tabla / RPC principal |
|-----------|------|------------------------|
| `046_performance_indexes.sql` | 9 | Índices performance |
| `047_security_phase10.sql` | 10 | Security hardening |
| `048_audit_phase12.sql` | 12 | audit_logs extendido |
| `049_plugins_phase13.sql` | 13 | clinic_plugins |
| `050_feature_flags_phase14.sql` | 14 | clinic_feature_flags |
| `051_clinic_jobs_phase15.sql` | 15 | clinic_jobs + RPCs worker |
| `052_observability_phase16.sql` | 16 | clinic_observability_events |

Ver [MIGRATIONS.md](./MIGRATIONS.md) para aplicar en remoto.

---

## Checklist post-roadmap (operaciones)

```powershell
npm test
npm run check:coverage
npm run check:supabase
npm run check:health -- --url=https://drflow.opusorg.com --strict
npm run build
```

Variables prod recomendadas: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (Vercel).

---

## Próximos pasos (post-enterprise)

Roadmap **producto** (no enterprise infra) — ver [ROADMAP.md](./ROADMAP.md):

- E2E ampliado (auth, atender ahora, booking)
- Integraciones reales (Mercado Pago, email, WhatsApp API)
- Compliance Habeas Data / consentimiento digital
- Tipos generados Supabase CLI

---

## Referencias

- [TESTING.md](./TESTING.md) — pirámide de tests, cobertura 90%  
- [PRODUCTION.md](./PRODUCTION.md) — Docker, backup, uptime  
- [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) — deploy prod  
- [RLS_AUDIT.md](./RLS_AUDIT.md) — políticas RLS  
