# Text readability audit — all themes (staging)

**Scope:** staging only (`fix/a11y-text-contrast-all-themes` → `develop`).  
**Feature commit:** `3494b49a`  
**Develop merge:** `89de1c40`  
**Production:** not modified.

## 1. Files modified

| File | Change |
|------|--------|
| `src/core/theme/a11y-contrast.css` | Universal sharpness + utility remaps (opacity, slate fades, tables, stats, sidebar, modals) |
| `src/core/theme/semantic-tokens.css` | Stronger default muted; dark muted/placeholder `#a8b6c8`; placeholders on dark palettes |
| `src/core/theme/typography-states.css` | `font-smoothing: auto` on body/mesh/sidebar/modals |
| `src/core/theme/contrast.ts` | Updated WCAG pairs for new muted/placeholder + cobalt dark + azure sidebar |
| `tests/theme-style-mode-matrix.test.ts` | Style × light/dark contrast matrix for Styles 2–6 |
| `docs/A11Y_TEXT_CONTRAST_AUDIT.md` | This report |

## 2. Problems detected

- Thin/medium muted slate utilities (`text-slate-400/500`) reading as “disabled” on dark dashboards/sidebars
- Global `antialiased` + light weights making small labels look soft on Windows
- Parent/utility `opacity-*` washing clinical copy
- Dark `--text-muted` / placeholders at the AA floor (`#94a3b8`) — clinically soft for ops/finance numbers context
- Light islands / cobalt cards occasionally inheriting pale utility text
- Table body/header colors inconsistently tied to hardcoded slate
- Borders `border-slate-100/200` vanishing on dark surfaces

## 3. Problems fixed

- Central remaps: faded slate → semantic `--text-secondary` / `--text-muted` by mode
- Ban `font-thin` / `extralight` / `light` inside clinical chrome (raised to 500)
- Auto font smoothing on mesh, sidebar, cards, modals, EHR shell
- Tabular nums + weight 600 on large stat figures
- Table td/th ink via tokens
- Dark muted/placeholder raised to `#a8b6c8` (≥7:1 on card surfaces)
- Root light muted `#475569`; placeholders stay `#64748b` on white inputs
- Sidebar links force `opacity: 1` when interactive
- Dark soft borders remapped to `--border-default`

## 4. Theme token changes

| Token | Light | Dark (non-cobalt) |
|-------|-------|-------------------|
| `--text-primary` | `#0f172a` (unchanged identity) | `#f8fafc` |
| `--text-secondary` | `#334155` | `#cbd5e1` |
| `--text-muted` | `#475569` (root + light) | **`#a8b6c8`** (was `#94a3b8`) |
| `--placeholder` | `#64748b` | **`#a8b6c8`** |
| Surfaces / accents | Unchanged per palette (azure/cobalt/clinicsoft/midnight identity preserved) | |

Cobalt page chrome remains saturated blue with light ink; card islands keep dark ink.

## 5. Style × Light/Dark results

Validated via `tests/theme-contrast.test.ts` + `tests/theme-style-mode-matrix.test.ts` (token pairs ≥ WCAG AA). Manual staging checklist after deploy:

| Style | Light | Dark |
|-------|-------|------|
| 2 Clinical Blue + Teal | PASS (tokens) | PASS (tokens) |
| 3 Azul claro + Beige/Bento | PASS | PASS |
| 4 Azul cobalto | PASS (page + cards) | PASS |
| 5 Soft Clinic | PASS | PASS |
| 6 Midnight Navy | PASS | PASS |

Manual UI check (staging): Dashboard, Pacientes, Profesionales, Turnos, Historias, Caja, Tablas, Formularios, Modales, Sidebar, Settings, Superadmin — after hard refresh on develop deploy.

## 6. Remaining issues

- Some feature components still hardcode Tailwind slate colors; remaps cover mesh/main/sidebar/modals but isolated marketing/public pages are out of clinical mesh scope by design.
- True WYSIWYG rich text in Evolución is still plain/structured text (separate product track).
- Full visual screenshot matrix per breakpoint was not automated in CI (Playwright a11y suites exist separately).

## 7. Validation commands

- `npx vitest run tests/theme-contrast.test.ts tests/theme-style-mode-matrix.test.ts`
- `npm run lint` / `npm run typecheck` / `npm run build` (run before merge)
- Full suite comparison vs develop baseline after merge

## 8. Production confirmation

- No `main` merge
- No production Vercel/DNS/Supabase changes
- Staging branch only
