# AAIP — Fase 24

> Separación clara: tareas técnicas vs administrativas/legales externas.  
> Registro de bases: **GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO**.  
> **No se afirma** que el registro AAIP haya ocurrido.

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

---

## Objetivo

Crear / consolidar `docs/compliance/AAIP-CHECKLIST.md` con secciones **Technical tasks** y **External administrative/legal tasks**, sin confundir controles de software con obligaciones ante la AAIP.

---

## Entregables

| Entrega | Ubicación |
|---------|-----------|
| Checklist | `docs/compliance/AAIP-CHECKLIST.md` |
| Catálogo TS | `src/core/compliance/aaip-checklist.ts` |
| Tests | `tests/aaip-checklist-fase24.test.ts` |

---

## Controles

| Control | Estado |
|---------|--------|
| Separación técnica / externa | ✅ |
| Flag registro bases | ✅ `GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO` |
| `claimsAaipRegistrationOccurred: false` | ✅ |
| Sin certificación Ley 25.326 | ✅ |

---

## Veredicto técnico

**OK** — Checklist y postura en código; el registro AAIP queda explícitamente fuera del alcance del software.

*No certifica cumplimiento AAIP ni Ley 25.326.*
