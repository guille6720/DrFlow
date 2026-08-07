-- Seed global PAMI planilla catalog (migrated from src/lib/constants/pami-planillas.ts).

INSERT INTO pami_planilla_categories (slug, clinic_id, label, description, sort_order)
VALUES
  ('internacion_domiciliaria', NULL, 'Internación domiciliaria', 'Solicitud de internación domiciliaria PAMI (módulo ID)', 10),
  ('geriatrico', NULL, 'Programa geriátrico', 'Evaluación geriátrica / seguimiento domiciliario', 20),
  ('insumos', NULL, 'Insumos y material', 'Pañales, gasas, sondas, material descartable', 30),
  ('nutricion', NULL, 'Nutrición enteral', 'Suplementos, fórmulas, SNG / gastrostomía', 40),
  ('kinesiologia_domiciliaria', NULL, 'Kinesiología domiciliaria', 'Sesiones kinésicas en domicilio', 50),
  ('oxigenoterapia', NULL, 'Oxigenoterapia', 'Concentrador, tubo de oxígeno, recarga', 60),
  ('cuidados_paliativos', NULL, 'Cuidados paliativos', 'Acompañamiento y cuidados en domicilio', 70)
ON CONFLICT (slug) WHERE clinic_id IS NULL DO UPDATE
  SET label = EXCLUDED.label,
      description = EXCLUDED.description,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();

SELECT public._upsert_global_pami_planilla_template(
  'internacion_domiciliaria',
  'id-inicial',
  'Internación domiciliaria — solicitud inicial',
  10,
  $body$SOLICITUD DE INTERNACIÓN DOMICILIARIA — PAMI

Paciente: {{paciente_nombre}}
DNI: {{paciente_dni}} | N° afiliado PAMI: {{paciente_pami}}

Diagnóstico: {{diagnostico}}
Motivo de internación domiciliaria: {{motivo}}

Domicilio de internación: {{domicilio}}
Cuidador responsable: {{cuidador}}

Plan terapéutico propuesto:
{{plan}}

Solicito autorización de módulo de Internación Domiciliaria PAMI.
Médico de cabecera: {{profesional}} — Mat. {{matricula}}$body$,
  $fields$[
    {"key":"motivo","label":"Motivo de internación","multiline":true,"placeholder":"EPOC descompensado, post operatorio..."},
    {"key":"diagnostico","label":"Diagnóstico principal (CIE-10)","placeholder":"J44.1 / Z51.1..."},
    {"key":"cuidador","label":"Cuidador responsable en domicilio","placeholder":"Familiar / cuidador PAMI"},
    {"key":"domicilio","label":"Domicilio de internación","multiline":true},
    {"key":"plan","label":"Plan terapéutico domiciliario","multiline":true,"placeholder":"Oxigenoterapia, antibiótico EV domiciliario, controles..."}
  ]$fields$::jsonb
);

SELECT public._upsert_global_pami_planilla_template(
  'internacion_domiciliaria',
  'id-seguimiento',
  'Internación domiciliaria — seguimiento / prórroga',
  20,
  $body$SEGUIMIENTO / PRÓRROGA — INTERNACIÓN DOMICILIARIA PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Evolución: {{evolucion}}

Justificación de continuidad: {{justificacion}}

Solicito prórroga del módulo de Internación Domiciliaria.
{{profesional}} — Mat. {{matricula}}$body$,
  $fields$[
    {"key":"evolucion","label":"Evolución clínica","multiline":true},
    {"key":"justificacion","label":"Justificación de prórroga","multiline":true}
  ]$fields$::jsonb
);

SELECT public._upsert_global_pami_planilla_template(
  'geriatrico',
  'geriatrico-eval',
  'Evaluación geriátrica integral',
  10,
  $body$SOLICITUD PROGRAMA GERIÁTRICO — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Motivo: {{motivo}}

Evaluación funcional / dependencia:
{{dependencia}}

Riesgo de caídas / estado cognitivo:
{{riesgo_caidas}}

Plan geriátrico propuesto:
{{plan}}

Solicito ingreso / seguimiento en módulo geriátrico PAMI.
{{profesional}} — Mat. {{matricula}}$body$,
  $fields$[
    {"key":"motivo","label":"Motivo de consulta geriátrica","multiline":true},
    {"key":"dependencia","label":"Nivel de dependencia (Barthel / observaciones)","multiline":true},
    {"key":"riesgo_caidas","label":"Riesgo de caídas / cognición","multiline":true},
    {"key":"plan","label":"Plan geriátrico","multiline":true,"placeholder":"Controles, medicación, derivaciones..."}
  ]$fields$::jsonb
);

SELECT public._upsert_global_pami_planilla_template(
  'insumos',
  'insumos-panales',
  'Insumos — pañales / material descartable',
  10,
  $body$SOLICITUD DE INSUMOS — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Insumos solicitados:
{{insumos}}

Cantidad / periodicidad: {{cantidad}}

Justificación clínica:
{{justificacion}}

{{profesional}} — Mat. {{matricula}}$body$,
  $fields$[
    {"key":"insumos","label":"Insumos solicitados","multiline":true,"placeholder":"Pañales talle M, 120 u/mes; guantes..."},
    {"key":"justificacion","label":"Justificación clínica","multiline":true,"placeholder":"Incontinencia urinaria, encamamiento..."},
    {"key":"cantidad","label":"Cantidad / periodicidad","placeholder":"120 unidades mensuales"}
  ]$fields$::jsonb
);

SELECT public._upsert_global_pami_planilla_template(
  'insumos',
  'insumos-sonda',
  'Insumos — sonda / catéter / oxígeno portátil',
  20,
  $body$SOLICITUD DE INSUMO MÉDICO — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Insumo / material: {{insumos}}

Indicación: {{justificacion}}

{{profesional}} — Mat. {{matricula}}$body$,
  $fields$[
    {"key":"insumos","label":"Detalle del insumo","multiline":true},
    {"key":"justificacion","label":"Indicación médica","multiline":true}
  ]$fields$::jsonb
);

SELECT public._upsert_global_pami_planilla_template(
  'nutricion',
  'nutricion-enteral',
  'Nutrición enteral / suplementos',
  10,
  $body$SOLICITUD NUTRICIÓN ENTERAL — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Fórmula / suplemento: {{formula}}
Vía: {{via}}
Cantidad: {{cantidad}}

Justificación clínica: {{justificacion}}

{{profesional}} — Mat. {{matricula}}$body$,
  $fields$[
    {"key":"formula","label":"Fórmula / suplemento","placeholder":"Ensure, Nutrison..."},
    {"key":"via","label":"Vía de administración","placeholder":"SNG / oral / gastrostomía"},
    {"key":"cantidad","label":"Cantidad mensual","placeholder":"30 sobres / 60 frascos"},
    {"key":"justificacion","label":"Justificación","multiline":true}
  ]$fields$::jsonb
);

SELECT public._upsert_global_pami_planilla_template(
  'kinesiologia_domiciliaria',
  'kine-domicilio',
  'Kinesiología domiciliaria',
  10,
  $body$SOLICITUD KINESIOLOGÍA DOMICILIARIA — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Diagnóstico: {{diagnostico}}

Objetivo: {{objetivo}}
Sesiones solicitadas: {{sesiones}}

Domicilio de atención: {{domicilio_paciente}}

{{profesional}} — Mat. {{matricula}}$body$,
  $fields$[
    {"key":"diagnostico","label":"Diagnóstico / motivo","multiline":true},
    {"key":"sesiones","label":"Cantidad de sesiones solicitadas","placeholder":"20 sesiones / 2 por semana"},
    {"key":"objetivo","label":"Objetivo terapéutico","multiline":true}
  ]$fields$::jsonb
);

SELECT public._upsert_global_pami_planilla_template(
  'oxigenoterapia',
  'oxigeno',
  'Oxigenoterapia domiciliaria',
  10,
  $body$SOLICITUD OXIGENOTERAPIA DOMICILIARIA — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Indicación: {{indicacion}}
Flujo y tiempo: {{flujo}}
Equipo: {{equipo}}

{{profesional}} — Mat. {{matricula}}$body$,
  $fields$[
    {"key":"indicacion","label":"Indicación (Sat O2, EPOC, IC...)","multiline":true},
    {"key":"flujo","label":"Flujo / horas por día","placeholder":"2 L/min — 12 hs/día"},
    {"key":"equipo","label":"Equipo solicitado","placeholder":"Concentrador + tubo de reserva"}
  ]$fields$::jsonb
);

SELECT public._upsert_global_pami_planilla_template(
  'cuidados_paliativos',
  'paliativos',
  'Cuidados paliativos domiciliarios',
  10,
  $body$SOLICITUD CUIDADOS PALIATIVOS — PAMI

Paciente: {{paciente_nombre}} | DNI {{paciente_dni}} | PAMI {{paciente_pami}}

Diagnóstico: {{diagnostico}}

Control de síntomas: {{sintomas}}

Plan de cuidados domiciliarios:
{{plan}}

{{profesional}} — Mat. {{matricula}}$body$,
  $fields$[
    {"key":"diagnostico","label":"Diagnóstico / estadio","multiline":true},
    {"key":"sintomas","label":"Control de síntomas","multiline":true},
    {"key":"plan","label":"Plan de cuidados","multiline":true}
  ]$fields$::jsonb
);
