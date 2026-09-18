-- Phase 6: staff RLS policies that call auth helpers must not apply to anon.
-- After Phase 5 EXECUTE hardening, anon cannot call can_manage_clinic / is_superadmin /
-- user_clinic_ids. PUBLIC policies that reference those helpers make OR-combined
-- SELECT fail closed for anonymous public booking / portal pages.

-- public_booking_links
DROP POLICY IF EXISTS public_booking_links_all ON public.public_booking_links;
CREATE POLICY public_booking_links_all ON public.public_booking_links
  FOR ALL TO authenticated
  USING (can_manage_clinic(clinic_id))
  WITH CHECK (can_manage_clinic(clinic_id));

-- clinics
DROP POLICY IF EXISTS clinics_select ON public.clinics;
CREATE POLICY clinics_select ON public.clinics
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (id IN (SELECT user_clinic_ids())));

-- professionals
DROP POLICY IF EXISTS professionals_manage ON public.professionals;
CREATE POLICY professionals_manage ON public.professionals
  FOR ALL TO authenticated
  USING (can_manage_clinic(clinic_id))
  WITH CHECK (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS professionals_select ON public.professionals;
CREATE POLICY professionals_select ON public.professionals
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));

-- specialties
DROP POLICY IF EXISTS specialties_manage ON public.specialties;
CREATE POLICY specialties_manage ON public.specialties
  FOR ALL TO authenticated
  USING (can_manage_clinic(clinic_id))
  WITH CHECK (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS specialties_select ON public.specialties;
CREATE POLICY specialties_select ON public.specialties
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));

-- locations (embedded / related public clinic data)
DROP POLICY IF EXISTS locations_manage ON public.locations;
CREATE POLICY locations_manage ON public.locations
  FOR ALL TO authenticated
  USING (can_manage_clinic(clinic_id))
  WITH CHECK (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS locations_select ON public.locations;
CREATE POLICY locations_select ON public.locations
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));

-- availability_rules (public occupancy / booking)
DROP POLICY IF EXISTS availability_rules_select ON public.availability_rules;
CREATE POLICY availability_rules_select ON public.availability_rules
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));

-- clinics_select_setup EXISTS into clinic_members; that table's select policy
-- calls user_clinic_ids and must not be evaluated for anonymous callers.
DROP POLICY IF EXISTS clinics_select_setup ON public.clinics;
CREATE POLICY clinics_select_setup ON public.clinics
  FOR SELECT TO authenticated
  USING (
    (auth.uid() IS NOT NULL)
    AND (NOT (EXISTS (
      SELECT 1 FROM clinic_members cm WHERE cm.clinic_id = clinics.id
    )))
  );

DROP POLICY IF EXISTS clinic_members_select ON public.clinic_members;
CREATE POLICY clinic_members_select ON public.clinic_members
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));
