-- Lote 132/132 · filas 13101-13114

INSERT INTO national_medications (
  source_key, catalog_source, active_ingredient, brand_name, presentation, laboratory,
  reference_price, source_updated_at, source_file
) VALUES
  ('7e21b10505bc6797fbe01fd0731f56d95ea3cddf', 'siafar', 'zolpidem', 'SUMENAN', '10 mg comp.x 30', 'Ariston', 21516.93, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('852056c13280adfbdb91d16412486b43b6e48801', 'siafar', 'zolpidem', 'NOCTE', '10 mg comp.x 30', 'Bagó', 23508.21, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('1fcf48d688d6d46324b1241ce9276130b61ebfc7', 'siafar', 'zolpidem', 'SOMIT', '10 mg comp.x 30', 'Gador', 23908.75, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('4e174de0c8cb2e4e4ca8d62af97067ff19f5b0a1', 'siafar', 'zolpidem', 'ZOLPIDEM TEVA', '10 mg tabl.x 30', 'Teva argentina', 23964.52, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('dc4195ee58f164d6039478902994f62c10d81d5d', 'siafar', 'zolpidem', 'SOMIT CR', '12.5 mg comp.lib.mod.x30', 'Gador', 32781.25, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('debfcae4461ee8adecacf524367d458ddc3d732e', 'siafar', 'zolpidem', 'SOMIT', '5 mg comp.x 30', 'Gador', 19873.91, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('ca28be9c077e6ef5982efd6c55e1b8080515e468', 'siafar', 'zolpidem', 'SOMIT CR', '6.25 mg comp.lib.mod.x30', 'Gador', 26319.8, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('62521ab7c2637298d098bde190c51d41dc7ca15c', 'siafar', 'zonisamide', 'KINAPLASE', '100 mg caps.x 30', 'Teva argentina', 84578.3, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('e4d67bd6469b28de1025c5bdc289b7ed298c5bc8', 'siafar', 'zonisamide', 'KINAPLASE', '50 mg caps.x 30', 'Teva argentina', 59408.86, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('a4985ec35d13b7f710fd35209f7fb429e72c50d4', 'siafar', 'zopiclona', 'DESCANIL/ZOPICLONA', '7.5 mg comp.x 30', 'Apotex', 18350, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('cb9e22d52ebb81dce5b36cde90708abbc2cbda65', 'siafar', 'zopiclona', 'INSOMNIUM', 'comp.x 30', 'Gador', 23408.15, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('454f723f739f5248f7788ad0c4c9d8912a7f94a9', 'siafar', 'zuclopentixol', 'CLOPIXOL', '10 mg comp.rec.x 50', 'Lundbeck', 94672.05, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('f7a980e4863b22225ccdc701eacc21d8b2094c99', 'siafar', 'zuclopentixol, acetato', 'CLOPIXOL ACUPHASE', '50 mg a.x 1 x 1 ml', 'Lundbeck', 77484.57, '2026-08-11', 'https://siafar.com/precios/pdf/'),
  ('445e88934d2dd937dbad9b25b392fb35b80b765b', 'siafar', 'zuclopentixol, decanoato', 'CLOPIXOL DEPOT', '200 mg a.x 1 x 1 ml', 'Lundbeck', 77484.57, '2026-08-11', 'https://siafar.com/precios/pdf/')
ON CONFLICT (source_key) DO UPDATE SET
  active_ingredient = EXCLUDED.active_ingredient,
  brand_name = EXCLUDED.brand_name,
  presentation = EXCLUDED.presentation,
  laboratory = EXCLUDED.laboratory,
  reference_price = EXCLUDED.reference_price,
  source_updated_at = EXCLUDED.source_updated_at,
  source_file = EXCLUDED.source_file,
  is_active = true;