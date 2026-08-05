# Informe de imágenes y assets estáticos — DrFlow

Auditoría (2026-07-30).

## Resumen

La aplicación tiene **pocas imágenes raster en el bundle web**: logo de marca, iconos PWA y OG image. Todo el contenido clínico (PDFs, estudios) se sirve desde **Supabase Storage** vía URLs firmadas, sin pasar por el optimizador de Next.js — correcto para preservar calidad diagnóstica.

| Categoría | Cantidad | Optimización |
|-----------|----------|--------------|
| Componentes `next/image` | 2 (`DrFlowLogo`, `PatientAppIcon`) | ✅ Mejorado |
| Tags `<img>` raw en `src/` | **0** | ✅ |
| Iconos Lucide (SVG inline) | ~50+ usos | N/A — vector, lazy por árbol React |
| Documentos clínicos | Supabase signed URLs | Sin compresión — calidad intacta |
| Fuentes | `next/font` (Jakarta, Geist Mono) | ✅ Self-hosted, subset latin |

---

## Inventario de assets servidos

### Estáticos en `/public` (generados o desplegados)

| Archivo | Uso | Formato |
|---------|-----|---------|
| `drflow-logo.png` | Logo marca (transparente) | PNG — optimizado vía `next/image` → WebP/AVIF |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | PWA consultorio (azul) | PNG — requerido por manifest |
| `icon-patient-*.png` | PWA paciente (verde) | PNG — requerido por manifest |
| `og-image.png` | Open Graph / Twitter | PNG — crawlers externos |
| `sw.js`, `sw-portal.js` | Service workers PWA | JS — precache de iconos |
| `*.svg` (next/vercel boilerplate) | No referenciados en app | Sin impacto en runtime |

Generación: `npm run icons` → `scripts/generate-pwa-icons.mjs` (sharp, PNG compression level 9).

### Metadata / App Router

- `src/app/icon.png` — copiado desde `icon-512.png` (favicon App Router)
- `src/app/manifest.ts` — manifest consultorio
- Portal: `portal/[slug]/manifest.webmanifest/route`

---

## Verificación solicitada

### ✅ Componente `Image` de Next.js

| Componente | Ubicaciones | `priority` | Lazy |
|--------------|-------------|------------|------|
| `DrFlowLogo` | Login (LCP), landing, sidebar, portal… | Solo en login/landing (`priority`) | Resto: lazy implícito + `loading="lazy"` |
| `PatientAppIcon` | Portal paciente, instalación PWA | Solo en pantalla instalación | Resto: lazy |

**No hay `<img>` nativos** en el código fuente de la aplicación.

### ✅ Tamaños optimizados (implementado)

**Problema detectado:** `PatientAppIcon` cargaba siempre `icon-patient-512.png` (512×512) aunque se renderizaba a 64–96 px.

**Corrección:** `resolvePatientAppIconSrc()` elige:
- ≤96 px display → `/icon-patient-192.png`
- \>96 px display → `/icon-patient-512.png`

`DrFlowLogo` y `PatientAppIcon` ahora declaran `sizes="{N}px"` para que el optimizador genere srcset acorde al tamaño renderizado.

### ✅ Formatos modernos (implementado)

`next.config.ts`:

```typescript
images: {
  formats: ["image/avif", "image/webp"],
  minimumCacheTTL: 60 * 60 * 24 * 30,
}
```

Los PNG en `/public` se sirven al navegador como **AVIF/WebP** cuando el cliente lo soporta. Los iconos PWA en manifest siguen siendo PNG (requisito de instalación).

### ✅ Carga diferida (implementado)

- `priority={true}` solo en above-the-fold: login brand panel, landing hero, instalación PWA.
- Sidebar, formularios secundarios, portal header: sin priority → lazy load.
- Documentos clínicos: se abren on-demand al pulsar "Ver" (signed URL), no precargados.

### ✅ Cache de assets estáticos (implementado)

Headers `Cache-Control: public, max-age=31536000, immutable` para PNG/SVG/fuentes en `next.config.ts` y `vercel.json`.

Service workers: `max-age=0, must-revalidate` (actualizaciones PWA).

---

## Fuera de alcance (intencional)

| Recurso | Motivo |
|---------|--------|
| PDFs / imágenes clínicas en Supabase | Calidad diagnóstica; signed URL directa |
| OG image | Crawlers requieren URL estable PNG/JPG |
| Iconos manifest PWA | Especificación exige PNG |
| SVG Lucide | Ya optimizados; no beneficio de rasterizar |

---

## Archivos modificados

```
src/core/components/brand/brand-image-utils.ts   (nuevo)
src/core/components/brand/drflow-logo.tsx
src/core/components/brand/patient-app-icon.tsx
next.config.ts
vercel.json
tests/brand-image-utils.test.ts
docs/IMAGE_ASSETS_AUDIT.md
```

---

## Métrica esperada

- **PatientAppIcon sm/md:** ~75% menos bytes en request original (192² vs 512² pixels) antes de compresión WebP/AVIF.
- **Repeat visits:** assets estáticos cacheados 1 año en CDN/navegador.
- **LCP login/landing:** sin cambio (ya usaban `priority`).
