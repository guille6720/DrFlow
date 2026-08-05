-- File upload hardening: allow admin document images in clinical-files bucket.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'text/csv',
  'application/octet-stream',
  'image/jpeg',
  'image/png'
]::text[]
WHERE id = 'clinical-files';
