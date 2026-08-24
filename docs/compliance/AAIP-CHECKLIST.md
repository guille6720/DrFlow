# Checklist AAIP — DrFlow Argentina

> Ley 25.326 de Protección de Datos Personales.  
> AAIP = Agencia de Acceso a la Información Pública.  
> **No constituye asesoramiento legal** ni certifica cumplimiento.  
> Fase 24 | Branch: `compliance/argentina-monetization`

**Registro de bases de datos ante AAIP:**  
`GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO`

**Este software no afirma que el registro AAIP haya ocurrido.**

Catálogo técnico: `src/core/compliance/aaip-checklist.ts`

---

## Technical tasks

Tareas implementables o documentables en software (controles técnicos).  
Estado “implementado” ≠ cumplimiento AAIP certificado.

| # | Tarea | Estado | Evidencia |
|---|-------|--------|-----------|
| 1 | Política de privacidad publicada | Existe — requiere abogado | `/privacidad` + borrador legal |
| 2 | Términos de servicio publicados | Existe — requiere abogado | `/terminos` + borrador legal |
| 3 | Aviso al paciente | Implementado | `/aviso-paciente` |
| 4 | Consentimiento en turnos web | Implementado | `record_patient_data_consent` |
| 5 | Consentimiento informado clínico | Implementado | consent-management |
| 6 | Pedidos ARCO / habeas data | Implementado | privacy-rights + export |
| 7 | Soft-delete pacientes con retención HC | Implementado | clinical-deletion-protection |
| 8 | Auditoría de accesos sensibles | Implementado | `audit_logs` inmutable |
| 9 | RLS multi-tenant | Implementado | rls-manifest |
| 10 | Sanitización IA antes de envío externo | Implementado | `sanitizeClinicalAIInput()` |
| 11 | Registro de subprocesadores | Implementado | `subprocessors.ts` |
| 12 | Política de retención configurable | Implementado | default 10 años |
| 13 | DPA con clínicas (plantilla) | Borrador | `DATA-PROCESSING-AGREEMENT-DRAFT.md` |
| 14 | Enumerar subprocesadores en privacidad in-app | Pendiente | Tras revisión legal |

---

## External administrative/legal tasks

No se resuelven con commits ni migraciones. Requieren abogado, titular del tratamiento y/o AAIP.

| # | Tarea | Autoridad | Flag |
|---|-------|-----------|------|
| 1 | **Análisis / registro de bases de datos ante AAIP** | AAIP | **GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO** |
| 2 | Designación de Responsable de Datos / contacto privacidad | Titular | GESTIÓN EXTERNA |
| 3 | Políticas de seguridad documentadas ante AAIP | Interno + AAIP | GESTIÓN EXTERNA |
| 4 | Evaluación de impacto (EIPD/DPIA) datos de salud | Consultor / AAIP | GESTIÓN EXTERNA |
| 5 | Contratos DPA firmados con subprocesadores | Proveedores + abogado | GESTIÓN EXTERNA |
| 6 | Base legal transferencias internacionales | Abogado | GESTIÓN EXTERNA |
| 7 | Actualización por Ley 27.706 (HCE) | Abogado especializado | REQUIERE VERIFICACIÓN |

### Registro de bases de datos (detalle)

**GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO**

- **No se afirma** que DrFlow, el operador SaaS o cada clínica hayan registrado bases ante AAIP.
- No hay constancia de inscripción en este repositorio.
- Si aplica inscripción, la evidencia es **externa** (constancia AAIP), no un feature flag ni una tabla.

Depende de (REQUIERE REVISIÓN LEGAL): quién es responsable vs encargado, tipo/volumen de datos, y criterios vigentes de la AAIP.

---

## Distinción responsable vs encargado

En borradores legales, el **Cliente (consultorio)** se describe como **responsable** de datos de pacientes y DrFlow como **encargado**.  
Eso **REQUIERE REVISIÓN DE ABOGADO** antes de uso comercial — no se certifica aquí.

---

*Fase 24. Controles técnicos ≠ registro AAIP ni conformidad Ley 25.326.*
