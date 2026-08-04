# DrFlow Enterprise Hardening v1.0

Remediación **Critical & Medium** alineada con el roadmap Enterprise Transformation (20 fases ya completadas).

## Resumen ejecutivo

| Área | Estado previo | Acción en hardening v1.0 |
|------|---------------|---------------------------|
| Fases 1–15 (spec v1.0) | ~90% cubiertas por Enterprise Transformation | Gap closure: lint React Compiler, splits agenda/settings, hooks compartidos |
| ESLint | 9 errors, 23 warnings | **0 errors** (target) |
| Tests | 289 passed | + tests utilidades hardening |
| Componentes >250 líneas (UI) | 12 archivos | Agenda + Settings refactorizados; backlog documentado |
| Cobertura core | ≥90% gate CI | Mantenida |
| Supabase auth URLs | Misconfig prod | Corregido (`config.toml` + Vercel `SITE_URL`) |

**Regla rectora:** estabilidad > compatibilidad > seguridad. Sin breaking changes.

---

## Fases — mapa vs Enterprise Transformation

| Hardening v1.0 | Enterprise (repo) | Estado |
|----------------|-------------------|--------|
| 1 Large components | Fase 2 refactor | ✅ Incremental: `agenda-view`, `settings-panel` |
| 2 Single responsibility | Fase 2–3 | ✅ Hooks/services extraídos |
| 3 Domain layer | `src/features/`, `lib/` | ✅ Existente |
| 4 Patient-centered | Fase 4 workspace tabs | ✅ Existente |
| 5 Dashboard ops | Fase 5 | ✅ Existente |
| 6 UX / palette | Fase 6 | ✅ Lint fixes palette |
| 7 Performance | Fase 9 | ✅ Existente |
| 8 Security | Fase 10 + migr. 047 | ✅ Existente |
| 9 Multi-tenant | Fase 11 (`clinic_id`) | ✅ Existente |
| 10 Audit | Fase 12 + migr. 048 | ✅ Existente |
| 11 DB indexes | Fase 9 migr. 046 | ✅ Existente |
| 12 Timeline | Fase 8 | ✅ Existente |
| 13 Code quality | Este hardening | ✅ Lint + dead imports |
| 14 Testing 90% | Fase 19 | ✅ Gate CI |
| 15 Final validation | CI + este doc | ✅ lint/test/build |

---

## Archivos modificados (hardening v1.0)

### Refactor Fase 1
- `src/components/agenda/agenda-view.tsx` — orquestador delgado
- `src/components/agenda/agenda-toolbar.tsx` — presentación
- `src/components/agenda/agenda-create-form.tsx` — formulario
- `src/lib/hooks/use-agenda-view.ts` — estado y lógica
- `src/components/configuracion/settings-panel.tsx` — orquestador
- `src/components/configuracion/settings-*-section.tsx` — secciones

### Lint / React Compiler (Fase 13)
- `src/components/accessibility/route-announcer.tsx`
- `src/components/command-palette/*`
- `src/components/configuracion/clinic-accessibility-panel.tsx`
- `src/components/historias/consultation-assistant-panel.tsx`
- `src/components/pacientes/patient-clinical-assistant-panel.tsx`

### Hooks / utils compartidos (Fases 2–3)
- `src/lib/hooks/use-deferred-pathology-search.ts`
- `src/lib/utils/consultation-pathology-query.ts`
- `src/lib/utils/command-palette-layout.ts`
- `src/lib/accessibility/read-reduced-motion.ts`

### Auth prod (incidente reset password)
- `supabase/config.toml`
- `scripts/print-supabase-redirects.mjs`

### Tests
- `tests/lib-hardening-utils.test.ts`

---

## Decisiones técnicas

1. **setState en effects:** diferido con `requestAnimationFrame` / `setTimeout(0)` para cumplir React Compiler sin cambiar UX.
2. **Command palette:** índices precomputados en `buildStaticPaletteSections` — evita mutación durante render.
3. **Pathology search:** hook `useDeferredPathologySearch` — DRY entre consulta y workspace paciente.
4. **Agenda:** patrón hook + toolbar + form — mismo comportamiento, archivos <200 líneas.
5. **Tenant boundary:** se mantiene `clinic_id` (schema existente); no se introduce `organization_id` paralelo.

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Regresión UI agenda/settings | Tests existentes + smoke manual |
| Reset password mails viejos | Pedir link nuevo post-fix Supabase |
| Componentes >250 restantes | Backlog priorizado (ver abajo) |

---

## Rollback

```powershell
git revert <commit-hardening>
npx supabase config push --yes   # restaurar config.toml anterior si aplica
```

Vercel: revertir `NEXT_PUBLIC_SITE_URL` en dashboard.

---

## Performance

- Memoización en `useAgendaView` (`filtered`, `weekDays`)
- Sin nuevas llamadas Supabase en caliente
- Impacto neto: **neutro / leve mejora** (menos re-renders en palette)

---

## Seguridad

- Sin cambios RLS en este batch
- Auth redirect URLs corregidas en Supabase + Vercel
- Validación server-side sin cambios

---

## Deuda técnica restante (componentes >250 líneas)

Prioridad P2 — próximo sprint:

| Líneas | Archivo |
|--------|---------|
| 366 | `lib/utils/clinical-export-pdf-parse.ts` |
| 348 | `lib/utils/patient-chart-model.ts` |
| 346 | `lib/actions/auth.ts` |
| 339 | `historias/nueva/consulta-form.tsx` |
| 327 | `portal/patient-portal-view.tsx` |
| 327 | `(auth)/register/page.tsx` |
| 302 | `pharmacology/pharmacology-search-view.tsx` |

---

## Validación

```powershell
npm run lint
npm test
npm run build
npm run enterprise:status
```

---

*Generado como parte de Enterprise Hardening v1.0 — complementa [ENTERPRISE_TRANSFORMATION.md](./ENTERPRISE_TRANSFORMATION.md).*
