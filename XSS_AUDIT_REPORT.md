# Informe de Auditoría — XSS (Cross-Site Scripting)

**Fecha:** 2026-08-04  
**Alcance:** Componentes React, hooks, server actions, renderizado dinámico  
**Quality gate:** ✅ 515+ tests

---

## Resumen ejecutivo

| Métrica | Resultado |
|---------|-----------|
| `dangerouslySetInnerHTML` en proyecto | **1** (script estático de tema — allowlisted) |
| `innerHTML` / `document.write` | **1** (planillas PAMI — corregido) |
| Markdown / HTML parsers | **0** |
| Contenido clínico dinámico | React text nodes + `sanitizeText` server-side |
| Riesgo global post-fix | **Bajo** |

---

## Hallazgos y correcciones

### 1. `dangerouslySetInnerHTML` — UI theme bootstrap

| Item | Detalle |
|------|---------|
| **Archivo** | `src/core/components/theme/ui-theme-bootstrap-script.tsx` |
| **Riesgo** | Bajo — script estático en `UI_THEME_BOOTSTRAP_SCRIPT`, sin input de usuario |
| **Acción** | **Sin cambio** — allowlisted en `security-gate.mjs` |
| **Test** | `tests/xss-audit.test.ts` verifica que no existan otros usos |

---

### 2. Reflected XSS — parámetro `error` en login

| Item | Detalle |
|------|---------|
| **Archivo** | `src/core/hooks/use-login-form.ts` |
| **Problema** | `searchParams.get("error")` decodificado y renderizado sin sanitizar |
| **Vector** | `/login?error=<script>…` reflejado en UI |
| **Corrección** | `sanitizeAuthErrorParam()` — whitelist OAuth + strip HTML |
| **Nuevo módulo** | `src/core/security/xss.ts` |

---

### 3. DOM XSS — `document.write` en impresión PAMI

| Item | Detalle |
|------|---------|
| **Archivo** | `src/lib/hooks/use-pami-planillas.ts` |
| **Problema** | Solo escapaba `<`; vulnerable a `"`, `'`, `&` en HTML injection |
| **Corrección** | `escapeHtml(rendered)` antes de `document.write` |

---

### 4. URL injection — telemedicina `room_url`

| Item | Detalle |
|------|---------|
| **Archivo** | `src/features/telemedicina/components/telemedicina/telemedicina-view.tsx` |
| **Problema** | `href={s.room_url}` sin validar protocolo |
| **Vector** | `javascript:` si DB comprometida |
| **Corrección** | `SafeExternalLink` — solo `http:` / `https:` |

---

### 5. Path injection — links dinámicos en copilot / alertas

| Item | Detalle |
|------|---------|
| **Archivos** | `clinical-copilot-sheet.tsx`, `admin-ops-copilot-sheet.tsx`, `proactive-care-panel.tsx` |
| **Problema** | `action.href` / `actionHref` en `<Link>` sin validar |
| **Corrección** | `SafeInternalLink` — solo paths relativos `/…`, bloquea `//` y `javascript:` |

---

### 6. Tabnabbing — `target="_blank"` sin `rel`

| Item | Detalle |
|------|---------|
| **Archivos** | `legal-consent-fields.tsx`, `agenda-view.tsx` |
| **Problema** | Links externos sin `rel="noopener noreferrer"` |
| **Corrección** | Atributo `rel` añadido |

---

### 7. Contenido clínico dinámico (sin cambio estructural)

| Patrón | Estado |
|--------|--------|
| `{order.order_text}` en `<p>` / `<pre>` | ✅ Seguro — React escapa text nodes |
| `sanitizeText()` en server actions | ✅ Strip tags + scripts al persistir |
| `sanitizeClinicalDisplayText()` | ✅ **Mejorado** — ahora usa `sanitizeDisplayText()` |
| AI copilot body en `<pre>` | ✅ Texto plano, no HTML |
| WhatsApp URLs | ✅ `https://wa.me/` + `encodeURIComponent` |

---

## Infraestructura añadida

| Archivo | Función |
|---------|---------|
| `src/core/security/xss.ts` | `sanitizeDisplayText`, `escapeHtml`, `sanitizeInternalPath`, `sanitizeExternalUrl`, `sanitizeAuthErrorParam` |
| `src/core/components/safe-link.tsx` | `SafeExternalLink`, `SafeInternalLink` |
| `tests/xss-audit.test.ts` | 6 tests de regresión XSS |

---

## Vectores eliminados

| Vector | Mitigación |
|--------|------------|
| Reflected XSS en login | `sanitizeAuthErrorParam` |
| DOM XSS en print PAMI | `escapeHtml` completo |
| `javascript:` en href externo | `sanitizeExternalUrl` |
| Open redirect / protocol en Link | `sanitizeInternalPath` |
| Tabnabbing | `rel="noopener noreferrer"` |
| HTML en display clínico importado | `sanitizeClinicalDisplayText` + server `sanitizeText` |

---

## Riesgo residual (BAJO)

| Item | Notas |
|------|-------|
| Theme bootstrap script | Estático; mantener fuera de input dinámico |
| Contenido DB pre-sanitización | RLS + `sanitizeText` en writes; display usa text nodes |
| Sin DOMPurify | No hay rich-text HTML editor; no requerido hoy |
| CSP headers | `next.config.ts` tiene headers de seguridad; revisar `script-src` periódicamente |

---

## Verificación

```
tests/xss-audit.test.ts        ✅ 6 tests
scripts/security-gate.mjs     ✅ dangerouslySetInnerHTML allowlist
npm run quality:gate:fast       ✅
```

---

## Archivos modificados

- `src/core/security/xss.ts` *(nuevo)*
- `src/core/components/safe-link.tsx` *(nuevo)*
- `src/core/hooks/use-login-form.ts`
- `src/lib/hooks/use-pami-planillas.ts`
- `src/lib/utils/sanitize-clinical-display.ts`
- `src/features/telemedicina/components/telemedicina/telemedicina-view.tsx`
- `src/features/ia/components/clinical-workflow/clinical-copilot-sheet.tsx`
- `src/features/ia/components/admin-ops/admin-ops-copilot-sheet.tsx`
- `src/features/ia/components/clinical-workflow/proactive-care-panel.tsx`
- `src/core/components/legal/legal-consent-fields.tsx`
- `src/features/agenda/components/agenda/agenda-view.tsx`
- `tests/xss-audit.test.ts` *(nuevo)*
