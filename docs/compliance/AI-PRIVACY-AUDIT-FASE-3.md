# Auditoría Fase 3 — Privacidad IA / Gemini

> **Estado:** Auditoría técnica + hardening implementado.
> **Fecha:** 2026-08-22
> **Rama:** `compliance/argentina-monetization`

**No constituye asesoramiento legal.** La sanitización técnica no elimina la obligación de DPA, base legal y aviso al titular cuando datos de salud salen a proveedores externos.

---

## 1. Alcance auditado

| Área | Archivos |
|------|----------|
| API clínica | `src/app/api/clinical-ai/route.ts` |
| Gemini/Vertex | `run-gemini-clinical.server.ts`, `vertex-gemini.server.ts` |
| BYOK LLM | `clinical-ai-llm-provider.server.ts` |
| Jobs background | `run-ai-task.ts` |
| Contexto paciente | `load-gemini-clinical-context.server.ts` |
| Stats consultorio | `gemini-clinic-stats.ts`, `load-gemini-clinic-stats.server.ts` |
| System prompt | `gemini-clinical-system-prompt.ts` |
| Admin ops | `admin-ops-ai/route.ts` — **sin LLM externo** |
| Pharmacology | `pharmacology/route.ts` — **sin LLM externo** |
| Dictado voz | `use-speech-to-text.ts` — **client-side, fuera de scope server** |
| Logs/telemetría | `ai-audit.ts`, `observability/api-route.ts` |
| Persistencia chat UI | `gemini-workspace-persistence.ts` — **localStorage cliente** |

---

## 2. Inventario de datos enviados a proveedores IA

| Dato | ¿Se envía? | Mitigación |
|------|-----------|------------|
| Nombre paciente | **No** (redactado) | `knownIdentifiers` + `[REDACTADO]` |
| DNI / CUIT / CUIL | **No** (redactado o bloqueo) | Regex + fail-safe |
| Email / teléfono | **No** | Regex + fail-safe |
| Dirección | **No** | Heurística `[DIRECCION]` |
| Credencial obra social | **No** | `[CREDENCIAL]` |
| Edad | **Sí** (derivada, no fecha nacimiento) | `ageYearsFromBirthDate` |
| Obra social (nombre) | **Sí** | No es identificador directo |
| Diagnóstico / evolución | **Sí** (texto clínico anonimizado) | Redacción identificadores en texto |
| Medicación / recetas en chat | **Sí** si médico escribe | Sanitización del mensaje |
| Nombres en stats consultorio | **No** | `PACIENTE_A`, `PACIENTE_B` |
| System prompt | **Sí** (estático, sin PHI) | Sin datos paciente |
| Chat history (16 turnos) | **Sí** (sanitizado) | Gateway obligatorio |
| Prompts completos en logs | **No** | `recordAiAuditEvent` sin contenido |
| API keys | **No** | Server-only env / DB |

---

## 3. Capa de sanitización centralizada

### Componentes (Fase 3)

| Módulo | Función |
|--------|---------|
| `sanitize-clinical-ai-input.ts` | `sanitizeClinicalAIInput()`, `sanitizeClinicalAIChatMessages()` |
| `patient-ai-identifiers.server.ts` | `loadPatientKnownIdentifiers()`, `buildPatientKnownIdentifiers()` |
| `external-clinical-ai-gateway.server.ts` | **`prepareExternalClinicalAiPayload()`** — puerta obligatoria antes de HTTP externo |
| | `callVertexGeminiSanitized()`, `callGeminiApiSanitized()` |
| | `sanitizeClinicalContextBlock()` |
| | `ClinicalAiSanitizationError` |

### Patrones detectados (Argentina)

- DNI: `12345678`, `12.345.678`
- CUIT/CUIL: `20-12345678-3`
- Email, teléfono AR, dirección (calle/av), credencial afiliado
- Nombres conocidos del paciente (desde DB)

### Fail-safe (Fase 4 integrada)

Si tras sanitizar queda PII residual → **`ClinicalAiSanitizationError`** → HTTP 422 en API / error en job. **No se envía al proveedor.**

---

## 4. Puntos de aplicación (todos server-side)

| Path | Sanitización | Gateway |
|------|-------------|---------|
| `runGeminiClinicalChat` | ✅ mensaje, history, contexto HC, stats | ✅ Vertex/Gemini |
| `/api/clinical-ai` BYOK | ✅ mensaje, context, body | ✅ vía `runUserAiChat` strict |
| `enhanceClinicalAiBodyIfConfigured` | ✅ body + context en mensaje | ✅ strict mode |
| `handleRunAiTaskJob` + LLM | ✅ body, lab text | ✅ strict mode |
| `loadGeminiClinicalContext` | ✅ cada campo HC | ✅ `sanitizeClinicalContextBlock` |
| `callVertexGemini` / `callGeminiApi` directos | ⚠️ Solo vía gateway sanitizado | No llamar directo desde features |

**No existe sanitización client-side** como única barrera — todo pasa por servidor.

---

## 5. Hallazgos y estado

### Resueltos en Fase 3

| # | Hallazgo | Estado |
|---|----------|--------|
| 1 | Mensaje médico con "Juan Pérez DNI..." sin redactar nombres conocidos | ✅ `loadPatientKnownIdentifiers` |
| 2 | Stats consultorio enviaban nombres reales | ✅ `formatGeminiClinicStatsContextForAI` |
| 3 | BYOK enviaba `patientName` en context summary | ✅ Sanitización + identifiers desde DB |
| 4 | Job `run_ai_task` enviaba nombre real como context | ✅ Token `PACIENTE_A` + body sanitizado |
| 5 | Vertex/Gemini llamables sin capa única | ✅ Gateway |
| 6 | System prompt pedía listar nombres en stats | ✅ Actualizado a tokens |
| 7 | `anonymizeClinicalText` insuficiente vs CUIT | ✅ `sanitizeClinicalAIInput` con orden CUIT→DNI |

### Riesgos residuales (no resueltos solo con código)

| # | Riesgo | Clasificación |
|---|--------|---------------|
| 1 | Texto clínico (diagnósticos) **sí sale** anonimizado — re-identificación teórica por IA | **LEGAL** — DPA + aviso IA |
| 2 | Médico escribe nombre no cargado en DB (tercero, familiar) | **TÉCNICO** — redacción parcial; no bloqueo |
| 3 | Dictado voz → navegador/OS | **CLIENT-SIDE** — fuera de gateway server |
| 4 | localStorage historial Gemini en browser | **CLIENT-SIDE** — PHI en dispositivo médico |
| 5 | Errores Vertex en logs server (`!response.ok return null`) | **BAJO** — no loguea body |
| 6 | Sentry puede capturar PHI si error incluye mensaje clínico | **P1** — scrubbing pendiente |

---

## 6. Tests

| Archivo | Cobertura |
|---------|-----------|
| `tests/sanitize-clinical-ai-input.test.ts` | DNI, CUIT, email, tel, nombres |
| `tests/external-clinical-ai-gateway.test.ts` | Gateway, fail-safe, identifiers |
| `tests/anonymize-clinical-context.test.ts` | Funciones base |

Ejecutar: `npx vitest run tests/sanitize-clinical-ai-input.test.ts tests/external-clinical-ai-gateway.test.ts`

---

## 7. Checklist Fase 3

| Requisito | Estado |
|-----------|--------|
| Auditar todos los puntos Gemini/Vertex | ✅ |
| `sanitizeClinicalAIInput()` centralizado | ✅ |
| Aplicar antes de **toda** request externa | ✅ (gateway) |
| Nunca solo client-side | ✅ |
| Detectar DNI, CUIT, email, tel, nombres, direcciones | ✅ |
| Fail-safe si falla anonimización | ✅ |
| Tests formatos argentinos | ✅ |
| Auditoría prompts/logs/telemetría | ✅ (sin almacenar prompts) |

---

## 8. Referencias

- Mapa de flujo: `docs/compliance/DATA-FLOW-ARGENTINA.md`
- Aviso IA borrador: `docs/legal/AI-PROCESSING-NOTICE-DRAFT.md`
- Código gateway: `src/lib/ai/external-clinical-ai-gateway.server.ts`
