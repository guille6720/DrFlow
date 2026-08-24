-- ROLLBACK 135_privacy_rights_requests (staging/local only).
-- Drops ARCO request queue table and policies. Does not touch patients/HC.
-- DO NOT run on production without an explicit ops runbook.

DROP TABLE IF EXISTS privacy_rights_requests CASCADE;
