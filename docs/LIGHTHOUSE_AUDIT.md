# Auditoría Lighthouse — DrFlow

Auditoría sobre rutas públicas de marketing (build de producción, mobile simulated).  
Comando: `npm run lighthouse:audit` (requiere `LIGHTHOUSE_AUDIT=1` para `next start` local).

Informes JSON: `coverage/lighthouse/*.report.json`

## Objetivos vs resultado final

| Métrica | Objetivo | Resultado |
|---------|----------|-----------|
| Performance | > 90 | ✅ 92–97 en todas las rutas auditadas |
| Accessibility | > 95 | ✅ 100 en todas |
| Best Practices | > 95 | ✅ 96–100 |
| SEO | > 90 | ✅ 100 |

## Puntuaciones por ruta

### Baseline (antes)

Build producción inicial (`localhost:3000`).

| Ruta | Perf | A11y | BP | SEO | Notas |
|------|------|------|-----|-----|-------|
| `/` | 100 | 94 | 96 | 92 | `target-size` en `<Link><Button>` |
| `/demo` | 100 | 94 | 96 | 92 | Idem + contraste en `Card` oscuro |
| `/privacidad` | 100 | 100 | 96 | 92 | — |
| `/terminos` | 100 | 93 | 96 | 92 | `target-size` |
| `/login` | — | — | — | — | Error `NO_FCP` (página 100% client) |

### Final (después)

Build producción optimizado (`localhost:3026` / `3027`).

| Ruta | Perf | A11y | BP | SEO |
|------|------|------|-----|-----|
| `/` | 95 | 100 | 96 | 100 |
| `/demo` | 96 | 100 | 96 | 100 |
| `/privacidad` | 97 | 100 | 100 | 100 |
| `/terminos` | 96 | 100 | 100 | 100 |
| `/login` | 92 | 100 | 96 | 100 |

## Cambios realizados e impacto

### 1. `ButtonLink` — enlaces accesibles sin anidación

**Archivos:** `src/components/ui/button.tsx`, páginas marketing (`page.tsx`, `demo`, `privacidad`, `terminos`, `probar`), `patient-app-landing-section.tsx`

**Problema:** `<Link><Button>` generaba controles anidados y touch targets < 44 px (`target-size`).

**Cambio:** Componente `ButtonLink` con clases compartidas y `min-h-11` (WCAG 2.2).

**Impacto:** A11y `/` y `/demo`: **94 → 100**. `/terminos`: **93 → 100**.

---

### 2. `robots.txt` + `sitemap.xml`

**Archivos:** `src/app/robots.ts`, `src/app/sitemap.ts`

**Problema:** Sin robots válido → auditoría SEO `-8` puntos (`robots-txt`).

**Cambio:** Generación nativa Next.js con allow/disallow de rutas app vs marketing.

**Impacto:** SEO en todas las rutas: **92 → 100**.

---

### 3. Middleware — bypass SEO assets

**Archivo:** `src/core/supabase/middleware.ts`

**Problema:** `/robots.txt` redirigía a login → robots inválido en runtime.

**Cambio:** Excluir `/robots.txt` y `/sitemap.xml` del flujo auth (junto a PWA assets).

**Impacto:** Habilita SEO 100 tras despliegue; crítico en producción.

---

### 4. Metadatos y JSON-LD

**Archivos:** `src/app/layout.tsx`, `demo/page.tsx`, `privacidad/page.tsx`, `terminos/page.tsx`, `login/page.tsx`, `src/core/components/seo/marketing-json-ld.tsx`

**Cambio:**
- `display: "swap"` en fuentes Google
- `robots`, `canonical`, títulos/descripciones por página
- Schema.org `SoftwareApplication` en homepage

**Impacto:** SEO consolidado; LCP estable con font-display swap.

---

### 5. Landmark `<main>` y navegación semántica

**Archivos:** `src/app/page.tsx`, `login-form-view.tsx`, `login-page-shell.tsx`

**Cambio:** `<main id="main-content">`, `<nav aria-label>` en header homepage.

**Impacto:** Mejor estructura documental; soporte a lectores de pantalla.

---

### 6. Contraste de color

**Archivos:** `patient-app-landing-section.tsx`, `demo/page.tsx`

**Problemas:**
- `<code>` sin color de texto explícito
- `Card` (tema oscuro dashboard) usado en marketing → texto `slate-900` sobre fondo oscuro

**Cambio:** `text-slate-800` en code; cards de demo reemplazadas por contenedores claros `bg-white`.

**Impacto:** A11y homepage y demo: contraste **100**.

---

### 7. Links distinguibles (`link-in-text-block`)

**Archivo:** `demo/page.tsx`

**Cambio:** Subrayado visible en links inline (`underline decoration-blue-400`).

**Impacto:** Demo A11y: **96 → 100**.

---

### 8. Login — FCP/LCP y bundle diferido

**Archivos:** `login/page.tsx`, `login-page-shell.tsx`, `login-form-view.tsx`

**Problemas:** Página `use client` sin contenido pintado (`NO_FCP`); LCP ~4 s por JS de auth.

**Cambios:**
- Página server con `dynamic()` + shell SSR con texto visible
- `GoogleLoginButton` cargado con `ssr: false`
- Metadatos SEO/canonical

**Impacto:** Login auditable; Performance **→ 92**, A11y/SEO **100**.

---

### 9. Script de auditoría reproducible

**Archivos:** `scripts/lighthouse-audit.mjs`, `package.json`, `src/instrumentation.ts`

**Cambio:** `npm run lighthouse:audit`; flag `LIGHTHOUSE_AUDIT=1` omite validación estricta de secrets solo para auditorías locales.

**Impacto:** Pipeline repetible en CI/local.

---

### 10. Tests estáticos

**Archivo:** `tests/lighthouse-audit.test.ts`

Valida robots/sitemap, bypass middleware y touch targets.

## Limitaciones conocidas

- **Dashboard autenticado** (`/agenda`, `/pacientes`, …): no auditado — requiere sesión; excluido en `robots.txt`.
- **Best Practices 96** en algunas rutas: Lighthouse mobile local; sin errores de consola en producción (en dev penaliza `unsafe-eval` de React).
- **Login Performance ~92**: límite por bundle mínimo de Supabase auth en cliente; mejoras futuras: formulario HTML estático server-only + islands para OAuth.

## Cómo repetir

```bash
npm run build
LIGHTHOUSE_AUDIT=1 npm run start
npm run lighthouse:audit -- --no-start --url=http://localhost:3000
```

## Rutas auditadas

`/`, `/login`, `/privacidad`, `/terminos`, `/demo`

Representan landing, conversión, legal y onboarding — superficie pública indexable.
