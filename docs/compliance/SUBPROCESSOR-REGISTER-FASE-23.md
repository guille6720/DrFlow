# Registro de subprocesadores — Fase 23

> Registro configurable solo con proveedores descubiertos en código.  
> Desconocidos: **REQUIERE VERIFICACIÓN**. No es asesoramiento legal.

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

---

## Objetivo

Mantener un registro machine-readable de subprocesadores con propósito, categorías de datos, health data, jurisdicción, DPA, review de transferencias y estado de documentación de privacidad/seguridad.

---

## Fuente canónica

`src/core/compliance/subprocessors.ts` → `SUBPROCESSOR_REGISTER`

Borrador legal sincronizado: `docs/legal/SUBPROCESSORS-DRAFT.md`

---

## Proveedores incluidos (descubiertos)

Supabase, Vercel, Google Cloud/Vertex, Mercado Pago, email (SMTP/Resend), Sentry, Daily.co, Jitsi, Meta WhatsApp, BYOK IA, REFEPS.

**No incluido:** analytics de producto (no hay SDK en el repo).

---

## Controles

| Control | Estado |
|---------|--------|
| Solo proveedores con evidencia en código | ✅ `codeEvidence` |
| Campos obligatorios por entrada | ✅ |
| Desconocidos = REQUIERE VERIFICACIÓN | ✅ |
| No inventar analytics | ✅ `SUBPROCESSORS_NOT_DISCOVERED` |
| Helpers de postura | ✅ `evaluateSubprocessorRegisterPosture` |

---

## Tests

`tests/subprocessor-register-fase23.test.ts`

---

## Veredicto técnico

**OK** — Registro configurable completo y alineado al código; pendientes de verificación contractual/jurisdiccional documentados sin fingir certeza.

*DPA firmados y transferencias: gestión externa / abogado.*
