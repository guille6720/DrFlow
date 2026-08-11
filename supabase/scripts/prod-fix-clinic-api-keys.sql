-- Production fix: Fase 4C API pública (migration 104). Safe to re-run.

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_booking_source_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_booking_source_check
  CHECK (booking_source IN ('manual', 'online', 'api'));

-- Full schema + RPCs: run supabase/migrations/104_clinic_api_keys.sql
