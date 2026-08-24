# Fase 15 — Headers de seguridad y seguridad de aplicación

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**

## Objetivo (PHASE 15)

Revisar e implementar controles razonables de seguridad de aplicación sin romper funcionalidad existente:

| Área | Estado técnico |
|------|----------------|
| CSP / HSTS / frame-ancestors | `SECURITY_RESPONSE_HEADERS` en `next.config` + `vercel.json` |
| Referrer-Policy / Permissions-Policy | `strict-origin-when-cross-origin` + política acotada |
| COOP / CORP | `same-origin` (Phase 15) |
| Cookies seguras | `httpOnly`, `secure` (prod), `SameSite=Lax` |
| CSRF | `requireSameOriginMutation` / `isSameOriginRequest` en mutaciones de sesión |
| Open redirect | `safeRedirectPathSchema` |
| XSS | `sanitizeDisplayText`, `sanitizeInternalPath`, `escapeHtml` |
| SQLi | Supabase client parametrizado + RLS (sin SQL dinámico de usuario) |
| SSRF | `isSafeOutboundUrl` en fetch de imágenes PDF |
| Upload / MIME | `file-upload.ts` magic-byte validation |
| Rate limit | API pública + auth login/reset (in-memory por instancia) |
| Brute force | Throttle login (30/15min IP) y reset (10/15min IP) |

## Qué se implementó / endureció

1. Módulo **`src/core/compliance/application-security.ts`** — matriz central  
2. **`src/core/security/rate-limit.ts`** — limiter genérico + presets auth  
3. **`src/core/security/ssrf.ts`** — bloqueo de hosts privados/metadata  
4. Auth **`login`** / **`reset-password`** — rate limit por IP  
5. **`billing/create-preference`** — CSRF same-origin  
6. **`pdf-image-data-url`** — SSRF guard + `no-store`  
7. Headers — **COOP** y **CORP** en `response-headers.ts` y `vercel.json`  
8. Tests **`tests/application-security-fase15.test.ts`**

## Verificación

```bash
npx vitest run tests/application-security-fase15.test.ts tests/security-headers.test.ts tests/security-phase10.test.ts tests/file-upload-audit.test.ts
npx tsc --noEmit
```

## Límites / no afirmar

- Rate limit in-memory no es global en serverless multi-instancia (complementa Supabase Auth).
- CSP mantiene `'unsafe-inline'` por compatibilidad con Next.js — endurecer requiere nonce/hash.
- Webhooks (Mercado Pago) y cron usan secretos, no CSRF de browser.
- Esta fase **no certifica** pentest ni cumplimiento legal por sí sola.

## Veredicto técnico Fase 15

**OK** — Headers OWASP, CSRF en mutaciones de sesión, cookies seguras, anti-SSRF en PDF, validación de uploads y throttling de auth verificados por tests.
