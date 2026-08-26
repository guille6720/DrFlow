-- Reconcile remote Staging migration 20260826120601_security_definer_anon_allowlist
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- DrFlow Phase 5: explicit anonymous allowlist for SECURITY DEFINER RPCs.
-- Staging only. Preserve signed-in/service access while removing anonymous
-- execution from every currently exposed SECURITY DEFINER function except
-- the intentional public portal/booking endpoints below.

DO $$
DECLARE
  r record;
  public_anon text[] := ARRAY[
    'cancel_patient_appointment',
    'get_patient_appointment_statuses',
    'get_patient_portal_appointments',
    'get_public_booking_occupancy',
    'record_patient_data_consent',
    'resolve_portal_clinic_id',
    'submit_public_booking'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);

    IF r.proname = ANY(public_anon) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.fn);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.fn);
    END IF;
  END LOOP;
END
$$;;
