# Receta electrónica — Argentina (Fase 17)

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal ni certificación regulatoria.**

## Objetivo (PHASE 17)

Auditar la funcionalidad de recetas. Hasta que DrFlow / el consultorio complete el registro u homologación legalmente requerida para recetas electrónicas con validez oficial:

- **No** afirmar que un borrador interno tiene validez legal oficial.
- Mantener lenguaje de UI de **borrador / local / sin homologación**.
- **No** simular aprobación gubernamental.
- Separar capacidades internas, requisitos técnicos, requisitos externos y ReNaPDiS.

Fuente de política en código: `src/core/compliance/prescription-compliance.ts`  
Disclaimer de producto: `src/types/prescription.ts` → `ARGENTINA_PRESCRIPTION_DISCLAIMER`

---

## Estado actual de DrFlow

**DrFlow NO está homologado ante REFEPS/RENaPDiS** para emitir recetas electrónicas con validez legal plena ante farmacias.

Texto de disclaimer incorporado:

> "Receta local / borrador — no es homologación REFEPS. Generada en DrFlow según Ley 25.649 (prescripción por nombre genérico). Para validez ante farmacias con trazabilidad REFEPS/RENaPDiS, la clínica debe completar homologación con el Ministerio de Salud de la Nación y firma digital habilitante."

---

## 1. Funcionalidad interna actualmente permitida

| Función | Estado | Notas |
|---------|--------|-------|
| Crear borrador | ✅ | Status `draft` |
| Emitir receta local | ✅ | Status `issued` — sin validez REFEPS; checkbox de disclaimer obligatorio |
| Imprimir / PDF | ✅ | Incluye disclaimer |
| Compartir WhatsApp / email | ✅ | Aviso de verificación + “no es homologación REFEPS” |
| Anular | ✅ | Status `void` |
| Adapter REFEPS | ✅ parcial | Sandbox (`REFEPS-SBX-*`) o API; no es aprobación MSN |
| Firma digital con validez legal | ❌ | GESTIÓN EXTERNA |
| Claim “receta electrónica oficial” | ❌ | Prohibido hasta homologación |

---

## 2. Requisitos técnicos (futura homologación)

- Integración REFEPS/RENaPDiS — **REQUIERE VERIFICACIÓN** regulatoria
- Firma digital del profesional con certificado habilitante — **GESTIÓN EXTERNA**
- Trazabilidad (número único, estado dispensación)
- Validación de matrícula — adapter `refeps` (sandbox hoy)
- Cumplimiento Ley 25.649 (genérico) — parcialmente soportado en UI/engine

---

## 3. Requisitos regulatorios externos

| Requisito | Autoridad | Notas |
|-----------|-----------|-------|
| Homologación REFEPS/RENaPDiS | Ministerio de Salud de la Nación | **REQUIERE REVISIÓN LEGAL** |
| Registro del software como prescriptor | REQUIERE REVISIÓN LEGAL | No afirmar cumplimiento |
| Firma digital certificada | Entidad certificante | Externa al producto |
| Obligaciones AAIP | AAIP | GESTIÓN EXTERNA |

---

## 4. ReNaPDiS

**REQUIERE VERIFICACIÓN** con asesor regulatorio en salud digital Argentina.

DrFlow **no debe** simular aprobación gubernamental. El modo sandbox genera identificadores `REFEPS-SBX-*` con disclaimer explícito de prueba.

---

## 5. Ítems que requieren verificación profesional legal/regulatoria

- Si el software debe registrarse formalmente como prescriptor electrónico.
- Alcance exacto de “homologación” por consultorio vs proveedor SaaS.
- Condiciones para que un identificador REFEPS/API tenga validez ante farmacias.
- Comunicación comercial permitida antes de homologación.

---

## Controles de producto reforzados (Fase 17)

1. Módulo **`prescription-compliance.ts`** — matriz interna / regulatoria / anti-claims  
2. Títulos PDF/impresión/UI — **RECETA LOCAL / BORRADOR** (no “receta electrónica oficial”)  
3. QR / PDF — lenguaje distinto para sandbox vs adapter API  
4. Labels UI — `Enviada (adapter REFEPS)` (no “Registrada” como aprobación MSN)  
5. Auditoría — “Emitió receta local (borrador — sin homologación REFEPS)”  
6. Tests **`tests/prescription-compliance-fase17.test.ts`**

## Verificación

```bash
npx vitest run tests/prescription-compliance-fase17.test.ts tests/prescription-document.test.ts
npx tsc --noEmit
```

## Recomendación comercial

- **Sí:** gestión de consultorio con borradores / recetas locales Ley 25.649  
- **No:** vender “receta electrónica oficial” hasta completar homologación  
- FAQ landing ya aclara sandbox/API + requisito MSN del consultorio

## Veredicto técnico Fase 17

**OK** — Recetas internas con disclaimer; sin simulación de aprobación gubernamental; documentación separada por alcance. **No certifica** validez legal de e-receta.
