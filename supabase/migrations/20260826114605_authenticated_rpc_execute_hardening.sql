-- Reconcile remote Staging migration 20260826114605_authenticated_rpc_execute_hardening
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- Phase 4 follow-up: remove anonymous EXECUTE from authenticated/clinic-scoped RPCs.
-- Preserve authenticated and service_role execution.

REVOKE EXECUTE ON FUNCTION public.create_staff_appointment_atomic(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid, text, text, boolean, text, text, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_staff_appointment_atomic(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid, text, text, boolean, text, text, text, text, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_clinical_record_atomic(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_clinical_record_atomic(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, text, text, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_clinical_record_atomic(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, timestamptz, text, text, text, text, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_clinical_record_atomic(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, timestamptz, text, text, text, text, jsonb, jsonb)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_clinical_record_atomic(uuid, uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_clinical_record_atomic(uuid, uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, text, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_clinical_record_atomic(uuid, uuid, uuid, uuid, uuid, text, text, text, text, uuid, timestamptz, text, text, text, text, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_clinical_record_atomic(uuid, uuid, uuid, uuid, uuid, text, text, text, text, uuid, timestamptz, text, text, text, text, jsonb, jsonb)
  TO authenticated, service_role;

-- Public API RPCs are reached through the server/API-key layer or authenticated
-- clinic users. The internal authorization helper rejects unauthenticated callers;
-- remove anonymous EXECUTE as defense in depth.
REVOKE EXECUTE ON FUNCTION public.assert_public_api_clinic_access(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_public_api_clinic_access(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.api_get_appointment(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_get_appointment(uuid, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.api_list_appointments(uuid, timestamptz, timestamptz, uuid, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_list_appointments(uuid, timestamptz, timestamptz, uuid, text, integer)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.api_submit_appointment(uuid, uuid, timestamptz, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_submit_appointment(uuid, uuid, timestamptz, text, text, text, text, text, text)
  TO authenticated, service_role;;
