# Aviso de Procesamiento con Inteligencia Artificial — DrFlow

> **BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL**

## 1. Alcance

DrFlow ofrece funcionalidades opcionales de inteligencia artificial para asistir a profesionales de la salud. Estas funcionalidades **no reemplazan** el criterio clínico ni constituyen diagnóstico automatizado.

## 2. Proveedores de IA

Según configuración del consultorio y de la plataforma, los datos pueden procesarse mediante:

- **Google Vertex AI / Gemini** (configuración de plataforma)
- **Proveedor elegido por la clínica** (BYOK: OpenAI, Anthropic, Gemini, compatible)
- **Procesamiento local rule-based** (sin envío a proveedor externo)

## 3. Datos enviados

Antes de cualquier envío a un proveedor externo, DrFlow aplica **sanitización server-side** (`sanitizeClinicalAIInput`) que redacta:

- Nombres de pacientes conocidos
- DNI, CUIT/CUIL
- Emails y teléfonos
- Direcciones y credenciales de afiliación

Si la sanitización no puede completarse, **la solicitud se bloquea** y no se envía al proveedor.

## 4. Datos NO enviados (por diseño)

- Prompts completos no se almacenan en auditoría
- API keys nunca se registran en logs
- Admin-ops copilot no usa LLM externo

## 5. Estadísticas de consultorio

Las consultas agregadas de pacientes en Gemini utilizan **tokens anonimizados** (PACIENTE_A, PACIENTE_B) en lugar de nombres reales.

## 6. Protocolos de investigación clínica

Funcionalidad de protocolos de ensayos clínicos y matching de candidatos está **desactivada por defecto** (flag `clinical_research_protocols`).  

Controles técnicos (Fase 18):

- UI de consulta: botón/panel ocultos o bloqueados si el flag está OFF  
- Server: `runGeminiClinicalChat` rechaza intents de reclutamiento/protocolo sin ejecutar matching  
- Activación requiere checklist de revisión legal/privacidad (`docs/compliance/CLINICAL-RESEARCH-AI-FASE-18.md`)

Su activación **no** debe hacerse en producción sin esa revisión previa.

## 7. Responsabilidades

- El **profesional** verifica toda sugerencia de IA antes de incorporarla a la historia clínica.
- El **consultorio** es responsable de informar a pacientes si corresponde según su política y la normativa aplicable.
- **DrFlow** implementa controles técnicos de minimización y bloqueo, pero no garantiza ausencia total de re-identificación por parte del proveedor de IA.

## 8. Transferencias internacionales

Los proveedores de IA (especialmente Google Cloud) pueden procesar datos fuera de Argentina. REQUIERE VERIFICACIÓN de base legal y DPA.

---

*Versión borrador: 2026-08-24. **BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL**. No es asesoramiento legal final.*
