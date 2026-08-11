# Configuración PAMI — Motor de recetas

**Estado:** Configurable (Etapa 1)  
**Normativa:** No hardcodeada en código

## Qué hace el motor hoy

Cuando la cobertura del paciente es PAMI (`isPamiCoverage()`):

1. `coverage_kind = 'PAMI'`
2. Búsqueda de medicamentos vía `search_pami_vademecum` (existente)
3. Campos obligatorios por defecto (configurables):
   - N° beneficio / afiliado (`insurance_number`)
   - Diagnóstico CIE-10
   - Texto de diagnóstico

## Qué NO está implementado (requiere normativa / integración)

- Validación PMO / autorizaciones PAMI
- Persistencia de `alfabeta_id` obligatoria en cada línea
- Trazabilidad REFEPS / RENaPDiS
- Formato oficial PAMI distinto al PDF local actual

## Cómo configurar reglas por clínica

Tabla `coverage_rules`:

```json
{
  "requiredFields": ["insurance_number", "diagnosis_cie10", "diagnosis_text"],
  "maxValidityDays": 30,
  "medicationSearch": "pami_vademecum",
  "infoMessages": ["Mensaje operativo para el médico"]
}
```

Si no hay fila para la clínica, se usan defaults en `default-coverage-rules.ts`.

## Planillas PAMI

Las planillas (internación, estudios, etc.) siguen en el módulo `features/pami/` como `medical_orders.order_type = 'pami_form'`. No forman parte del motor de recetas medicamentosas.
