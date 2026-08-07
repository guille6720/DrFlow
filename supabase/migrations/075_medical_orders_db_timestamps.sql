-- Timestamps autoritativos en PostgreSQL (NOW() / triggers) para órdenes y recetas.

-- medical_orders: issued_at ya tiene DEFAULT now() en INSERT (015).
-- Solo falta auto-actualizar updated_at en UPDATE.
DROP TRIGGER IF EXISTS trg_medical_orders_updated ON medical_orders;
CREATE TRIGGER trg_medical_orders_updated
  BEFORE UPDATE ON medical_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- prescription_drafts: issued_at al emitir + updated_at en cada UPDATE.
CREATE OR REPLACE FUNCTION prescription_drafts_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'issued' AND (OLD.status IS DISTINCT FROM 'issued') THEN
    NEW.issued_at := COALESCE(NEW.issued_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescription_drafts_updated ON prescription_drafts;
CREATE TRIGGER trg_prescription_drafts_updated
  BEFORE UPDATE ON prescription_drafts
  FOR EACH ROW EXECUTE FUNCTION prescription_drafts_before_update();
