-- Firmas de profesionales: imagen + texto reutilizable en documentos clínicos.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS signature_text TEXT,
  ADD COLUMN IF NOT EXISTS signature_image_path TEXT;

COMMENT ON COLUMN professionals.signature_text IS 'Línea de firma impresa (ej. Dr/a. Nombre — Mat. XXXXX).';
COMMENT ON COLUMN professionals.signature_image_path IS 'Ruta en storage clinical-files para imagen de firma.';

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[],
  file_size_limit = GREATEST(file_size_limit, 2097152)
WHERE id = 'clinical-files';
