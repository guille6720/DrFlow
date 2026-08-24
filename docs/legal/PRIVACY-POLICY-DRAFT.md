# Política de Privacidad — DrFlow

> **BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL**

## 1. Responsable y encargado

- **Responsable del tratamiento** de datos de pacientes: el consultorio médico usuario de DrFlow.
- **Encargado del tratamiento**: DrFlow ([RAZÓN SOCIAL — REQUIERE VERIFICACIÓN], CUIT [REQUIERE VERIFICACIÓN]).

## 2. Datos que procesamos

| Categoría | Ejemplos |
|-----------|----------|
| Datos de cuenta | Nombre, email, rol en consultorio |
| Datos de pacientes | Nombre, DNI, contacto, cobertura |
| Datos de salud | Historias clínicas, diagnósticos, recetas, adjuntos |
| Datos de uso | Logs de auditoría, métricas de uso |
| Datos de pago | Información de suscripción (vía Mercado Pago) |

## 3. Finalidades

- Prestación del servicio SaaS
- Gestión de consultorios y pacientes
- Cumplimiento de obligaciones legales
- Seguridad y prevención de fraude
- Mejora del servicio (datos agregados/anónimos)

## 4. Base legal

REQUIERE REVISIÓN LEGAL — consentimiento, ejecución contractual, obligación legal, interés legítimo según corresponda.

## 5. Subprocesadores

DrFlow utiliza proveedores tecnológicos para operar el servicio. Lista actual en `src/core/compliance/subprocessors.ts` y documento `docs/legal/SUBPROCESSORS-DRAFT.md`.

Principales: Supabase, Vercel, Google Cloud (IA opcional), Mercado Pago, proveedor de email.

## 6. Transferencias internacionales

Algunos subprocesadores pueden procesar datos fuera de Argentina. REQUIERE VERIFICACIÓN de bases legales y cláusulas contractuales (DPA).

## 7. Retención

- Historias clínicas: mínimo configurable (default 10 años desde última entrada)
- Auditoría: permanente
- Datos de cuenta: mientras dure la relación contractual

## 8. Derechos del titular (ARCO)

Los pacientes deben ejercer sus derechos ante el consultorio (responsable). DrFlow asiste al consultorio con herramientas de exportación y gestión.

**Importante:** La eliminación de datos personales no implica destrucción de historias clínicas cuando exista obligación legal de conservación (Ley 26.529).

## 9. Seguridad

Medidas técnicas: cifrado en tránsito (HTTPS), RLS multi-tenant, auditoría inmutable, almacenamiento privado. Ver `docs/legal/SECURITY-ANNEX-DRAFT.md`.

## 10. Contacto

[EMAIL PRIVACIDAD — REQUIERE VERIFICACIÓN]

---

*Versión borrador: 2026-08-24. **BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL**. No es asesoramiento legal final.*
