-- Medical orders: laboratory panels with their determinations (global catalog only).
-- Data-only and idempotent. metadata.detail is prefilled as the item detail and printed in the PDF.

INSERT INTO public.medical_order_catalog (clinic_id, order_category, group_label, name, metadata, sort_order)
SELECT NULL, 'laboratorio', 'Perfiles', v.name, jsonb_build_object('detail', v.detail), v.ord
FROM (VALUES
  ('Rutina de laboratorio', 'Hemograma completo, eritrosedimentación, glucemia, urea, creatinina, ácido úrico, colesterol total, HDL, LDL, triglicéridos, GOT, GPT, fosfatasa alcalina, orina completa', 1),
  ('Hepatograma completo', 'GOT (AST), GPT (ALT), fosfatasa alcalina, GGT, bilirrubina total, directa e indirecta, proteínas totales, albúmina', 2),
  ('Perfil lipídico completo', 'Colesterol total, HDL, LDL, triglicéridos', 3),
  ('Perfil renal', 'Urea, creatinina, ácido úrico, ionograma (Na, K, Cl), orina completa', 4),
  ('Perfil tiroideo', 'TSH, T4 libre, T3, anticuerpos anti-TPO', 5),
  ('Perfil férrico', 'Hierro sérico, ferritina, transferrina, saturación de transferrina', 6),
  ('Coagulograma completo', 'Tiempo de protrombina (TP / RIN), KPTT, recuento de plaquetas, fibrinógeno', 7)
) AS v(name, detail, ord)
ON CONFLICT DO NOTHING;

UPDATE public.medical_order_catalog c
SET metadata = c.metadata || jsonb_build_object('detail', v.detail),
    updated_at = now()
FROM (VALUES
  ('Hemograma completo', 'Recuento de glóbulos rojos, hemoglobina, hematocrito, índices hematimétricos, glóbulos blancos con fórmula leucocitaria, plaquetas'),
  ('Ionograma', 'Sodio, potasio, cloro'),
  ('Orina completa', 'Examen físico-químico y sedimento urinario')
) AS v(name, detail)
WHERE c.clinic_id IS NULL
  AND c.order_category = 'laboratorio'
  AND c.name = v.name
  AND NOT (c.metadata ? 'detail');
