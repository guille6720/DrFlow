DELETE FROM public.medical_order_catalog
WHERE clinic_id IS NULL
  AND order_category = 'laboratorio'
  AND group_label = 'Perfiles'
  AND name IN (
    'Rutina de laboratorio', 'Hepatograma completo', 'Perfil lipídico completo', 'Perfil renal',
    'Perfil tiroideo', 'Perfil férrico', 'Coagulograma completo'
  );

UPDATE public.medical_order_catalog
SET metadata = metadata - 'detail', updated_at = now()
WHERE clinic_id IS NULL
  AND order_category = 'laboratorio'
  AND name IN ('Hemograma completo', 'Ionograma', 'Orina completa');
