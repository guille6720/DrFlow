# Configuración PAMI — Motor de recetas

**Estado:** Configurable (Etapa 5)  
**Normativa:** No hardcodeada en código

## Qué hace el motor hoy

Cuando la cobertura del paciente es PAMI (`isPamiCoverage()`):

1. `coverage_kind = 'PAMI'`
2. Búsqueda de medicamentos vía `search_pami_vademecum` (existente)
3. Campos obligatorios por defecto (configurables):
   - N° beneficio / afiliado (`insurance_number`)
   - Diagnóstico CIE-10
   - Texto de diagnóstico
4. QR de verificación local en PDF/vista previa (activado por default; desactivable por clínica)

## Qué NO está implementado (requiere normativa / integración)

- Validación PMO / autorizaciones PAMI
- Trazabilidad REFEPS / RENaPDiS
- Formato oficial PAMI distinto al PDF local actual

## Vademécum PAMI (v1.2+)

Al elegir un medicamento del vademécum PAMI, la línea guarda `vademecum_code` (ID Alfabeta) y lo muestra en wizard, vista previa, PDF e impresión.

## Cómo configurar reglas por clínica

### UI (recomendado)

**Configuración → Coberturas** (`/configuracion?seccion=coberturas&grupo=coberturas`)

Panel **Motor de recetas** con pestañas PAMI / Obras sociales / Prepagas / Particular:

- Campos obligatorios al emitir
- Vigencia máxima (días)
- Fuente de búsqueda de medicamentos
- Mostrar/ocultar QR en documento
- Mensajes informativos (no bloqueantes)
- **Restaurar defaults** elimina el override de la clínica

Requiere permiso `manageSettings`.

### Tabla `coverage_rules` (avanzado)

```json
{
  "requiredFields": ["insurance_number", "diagnosis_cie10", "diagnosis_text"],
  "maxValidityDays": 30,
  "medicationSearch": "pami_vademecum",
  "documentQr": true,
  "infoMessages": ["Mensaje operativo para el médico"]
}
```

Si no hay fila para la clínica, se usan defaults en `default-coverage-rules.ts`.

Los overrides se aplican:

- Al **guardar/emitir** recetas (servidor, motor de validación)
- Al **generar PDF / vista previa** (QR y reglas de documento)

## Planillas PAMI

Las planillas (internación, estudios, etc.) siguen en el módulo `features/pami/` como `medical_orders.order_type = 'pami_form'`. No forman parte del motor de recetas medicamentosas.
