# Fase 18 — IA de investigación / protocolos clínicos

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-24  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**

## Objetivo (PHASE 18)

Auditar funcionalidad de:

- investigación clínica / ensayos
- reclutamiento / screening de candidatos
- matching a protocolos
- identificación de candidatos vía IA

**No** habilitar automáticamente en producción. Colocar detrás de feature flag y documentar la revisión de privacidad/legal requerida.

## Superficies encontradas

| Superficie | Control |
|------------|---------|
| Panel «Protocolos» en consulta | Flag `clinical_research_protocols` — botón oculto si OFF |
| `DrappProtocolsQuickPanel` | Mensaje de bloqueo si flag OFF |
| Matching Gemini (candidatos / catálogo NCT) | Gate server-side en `runGeminiClinicalChat` |
| Prompts sugeridos Gemini | Sin sugerencias de reclutamiento si flag OFF |
| Lexicón `GEMINI_CLINICAL_PROTOCOLS` | Solo usado cuando el flag permite research |

## Flag

- **ID:** `clinical_research_protocols`
- **Default:** `false` (OFF)
- **Requires plugin:** `ia`
- **Categoría:** compliance

## Revisión legal / privacidad antes de activar

Checklist en código: `CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW`  
(`src/core/compliance/clinical-research-ai.ts`)

| Ítem | Estado |
|------|--------|
| Aviso / consentimiento sobre uso de HC para screening | REQUERIDO |
| Limitación de finalidad (interno vs sponsor/CRO) | REQUERIDO |
| Subprocesador IA + transferencias internacionales | REQUERIDO |
| Minimización / tokens anonimizados | REQUERIDO |
| Control de quién activa el flag y ve candidatos | REQUERIDO |
| Comité de ética / IP del estudio | Recomendado |
| Actualización AAIP / política de privacidad | Recomendado |

Ver también: `docs/legal/AI-PROCESSING-NOTICE-DRAFT.md` §6.

## Qué se reforzó en Fase 18

1. Módulo **`clinical-research-ai.ts`** — superficies, checklist, detección de intent  
2. **Server gate** — si flag OFF y el mensaje es research/recruitment → respuesta rule-based de bloqueo (sin matching)  
3. **`parseGeminiClinicStatsQuery({ allowClinicalResearchProtocols })`** — no adjunta protocolos si OFF  
4. UI consulta — botón Protocolos solo con flag ON  
5. UI Gemini — copy y sugerencias sin reclutamiento por defecto  
6. Doc + tests **`tests/clinical-research-ai-fase18.test.ts`**

## Verificación

```bash
npx vitest run tests/clinical-research-ai-fase18.test.ts
npx tsc --noEmit
```

## Límites / no afirmar

- El matching por texto de HC **no** es elegibilidad final del sponsor.
- Activar el flag en un consultorio **no** certifica cumplimiento AAIP ni ética de investigación.
- Esta fase **no** autoriza cesión de listados de pacientes a terceros.

## Veredicto técnico Fase 18

**OK** — Research/recruitment detrás de flag default OFF; gate UI + server; checklist de revisión documentada. **No auto-habilitado en producción.**
