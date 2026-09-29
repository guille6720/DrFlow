-- Rollback of 20260929121000. Prefer rolling back 20260929120000 entirely (drops the trigger), because the
-- previous guard body blocks browser INSERTs into prescription_drafts.
-- Run: supabase/migrations/rollback/20260929120000_national_eprescription_repository.down.sql
SELECT 1;
