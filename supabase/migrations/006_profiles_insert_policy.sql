-- Permitir crear perfil propio si el trigger de signup falló
DO $$ BEGIN
  CREATE POLICY profiles_insert ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
