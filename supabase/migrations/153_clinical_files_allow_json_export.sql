-- Allow JSON clinical exports in clinical-files (bulk export staging).
-- Error seen in production: "mime type application/json;charset=utf-8 is not supported"

UPDATE storage.buckets
SET
  allowed_mime_types = (
    SELECT ARRAY(
      SELECT DISTINCT mime
      FROM unnest(
        COALESCE(allowed_mime_types, ARRAY[]::text[])
        || ARRAY[
          'application/json',
          'application/fhir+json',
          'text/plain',
          'text/csv',
          'application/zip',
          'application/octet-stream',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'image/jpeg',
          'image/png',
          'image/webp'
        ]::text[]
      ) AS mime
      ORDER BY mime
    )
  )
WHERE id = 'clinical-files';
