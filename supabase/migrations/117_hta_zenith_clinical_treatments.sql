-- Tratamientos HTA / screening ZENITH (clases y conductas; no son marcas comerciales).

INSERT INTO clinical_treatments (name, kind, category, synonyms, sort_order)
SELECT v.name, v.kind, v.category, v.synonyms, v.sort_order
FROM (
  VALUES
    ('IECA', 'pharmacologic', 'Farmacológicos', ARRAY['ieca','inhibidor eca','enalapril','ramipril','perindopril'], 101),
    ('ARA II', 'pharmacologic', 'Farmacológicos', ARRAY['ara ii','arb','losartan','valsartan','telmisartan','candesartan'], 102),
    ('Calcioantagonista', 'pharmacologic', 'Farmacológicos', ARRAY['calcioantagonista','amlodipina','nifedipina','bloqueante calcio'], 103),
    ('Betabloqueante', 'pharmacologic', 'Farmacológicos', ARRAY['betabloqueante','beta bloqueante','bisoprolol','atenolol','carvedilol','nebivolol'], 104),
    ('Diurético tiazídico', 'pharmacologic', 'Farmacológicos', ARRAY['tiazida','hidroclorotiazida','indapamida','clortalidona','diuretico tiazidico'], 111),
    ('Antagonista de aldosterona', 'pharmacologic', 'Farmacológicos', ARRAY['espironolactona','eplerenona','anti aldosterona'], 112),
    ('Control de PA', 'conduct', 'Conductas', ARRAY['control pa','control tension','control de tension'], 541),
    ('Optimizar antihipertensivos', 'conduct', 'Conductas', ARRAY['optimizar hta','titular antihipertensivo','ajustar hta'], 521),
    ('Evaluar estudio ZENITH', 'conduct', 'Conductas', ARRAY['zenith','nct07181109','screening zenith','derivacion zenith'], 645)
) AS v(name, kind, category, synonyms, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM clinical_treatments t
  WHERE lower(t.name) = lower(v.name)
    AND t.kind = v.kind
);
