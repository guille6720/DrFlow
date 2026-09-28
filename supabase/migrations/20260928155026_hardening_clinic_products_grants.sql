REVOKE ALL PRIVILEGES ON TABLE public.clinic_products FROM anon, authenticated;
GRANT SELECT ON TABLE public.clinic_products TO authenticated;
