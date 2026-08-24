# Documentos legales — Fase 22

> Plantillas en `docs/legal/` para revisión de abogado.  
> **No constituyen asesoramiento legal final.**

Última actualización: 2026-08-24 | Branch: `compliance/argentina-monetization`

---

## Objetivo

Crear / consolidar borradores profesionales con el aviso obligatorio:

`BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL`

No presentar plantillas generadas como consejo legal definitivo.

---

## Entregables

| Documento | Ruta |
|-----------|------|
| Términos de Servicio | `docs/legal/TERMS-OF-SERVICE-DRAFT.md` |
| Política de Privacidad | `docs/legal/PRIVACY-POLICY-DRAFT.md` |
| DPA | `docs/legal/DATA-PROCESSING-AGREEMENT-DRAFT.md` |
| Subprocesadores | `docs/legal/SUBPROCESSORS-DRAFT.md` |
| Anexo de Seguridad | `docs/legal/SECURITY-ANNEX-DRAFT.md` |
| Aviso IA | `docs/legal/AI-PROCESSING-NOTICE-DRAFT.md` |
| Índice | `docs/legal/README.md` |
| Catálogo TS | `src/core/compliance/legal-documents.ts` |
| Tests | `tests/legal-documents-fase22.test.ts` |

---

## Controles

| Control | Estado |
|---------|--------|
| Seis plantillas en `docs/legal/` | ✅ |
| Banner de abogado en cada una | ✅ |
| Catálogo + postura “no es consejo final” | ✅ |
| Alineación subprocesadores ↔ código | ✅ (doc apunta a `subprocessors.ts`) |

---

## Relación con la app

Los textos in-app (`src/core/legal/content/*`, rutas `/terminos`, `/privacidad`) son el contenido publicado actual. Esta fase **no** los sustituye automáticamente: la versión comercial debe pasar por abogado y luego sincronizarse.

---

## Veredicto técnico

**OK** — Plantillas listas para revisión legal; banner obligatorio presente; no se afirman como documentos finales.

*Uso comercial requiere abogado en Argentina.*
