-- Reconcile remote Staging migration 20260826120822_security_definer_internal_service_only
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- DrFlow Phase 5: remove direct browser access from internal SECURITY DEFINER helpers.
-- Staging only.

-- Patient portal legacy identity model (slug + DNI) is not a sufficient authorization factor.
-- Keep server-only until a signed, scoped patient session/token is implemented.
REVOKE EXECUTE ON FUNCTION public.cancel_patient_appointment(text,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text,text,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_patient_portal_appointments(text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_patient_data_consent(text,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_patient_appointment(text,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text,text,uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_portal_appointments(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_patient_data_consent(text,text,text,text,boolean) TO service_role;

-- Internal/migration/trigger helpers. Direct authenticated execution is unnecessary and unsafe.
REVOKE EXECUTE ON FUNCTION public._upsert_global_pami_planilla_template(text,text,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.append_appointment_status_history(uuid,uuid,public.appointment_status,public.appointment_status,public.waiting_room_status,public.waiting_room_status,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_pending_appointment_reminders(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_appointment_notification_events(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_lapsed_clinic_entitlement_trials(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._upsert_global_pami_planilla_template(text,text,text,integer,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.append_appointment_status_history(uuid,uuid,public.appointment_status,public.appointment_status,public.waiting_room_status,public.waiting_room_status,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_pending_appointment_reminders(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_appointment_notification_events(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_lapsed_clinic_entitlement_trials(uuid) TO service_role;;
