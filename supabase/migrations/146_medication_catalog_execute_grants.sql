-- Ensure medication catalog RPC is executable by authenticated staff and service_role.
REVOKE EXECUTE ON FUNCTION public.search_medication_catalog(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_medication_catalog(TEXT, INTEGER) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.search_pami_vademecum(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_pami_vademecum(TEXT, INTEGER) TO authenticated, service_role;
