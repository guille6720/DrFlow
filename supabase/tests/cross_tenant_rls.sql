-- DrFlow — prueba manual cross-tenant (SQL Editor, rol postgres / service)
-- Objetivo: confirmar que un usuario de clínica A no lee pacientes de clínica B vía RLS.
--
-- PRE-requisitos:
--   1. Dos clínicas con id conocidos: :clinic_a, :clinic_b
--   2. Usuario U solo miembro activo de clínica A (no superadmin)
--   3. Paciente P_B en clínica B
--
-- Sustituí los UUID antes de ejecutar.

-- Paso 1: como postgres, verificar filas (sin RLS para admin)
-- SELECT id, clinic_id, first_name FROM patients WHERE clinic_id IN (
--   '00000000-0000-0000-0000-000000000001',
--   '00000000-0000-0000-0000-000000000002'
-- );

-- Paso 2: simular sesión del usuario U (Supabase local: tests.authenticate_as)
-- En hosted: iniciar sesión en la app como U y probar desde API, o usar JWT de prueba.

-- Paso 3: consulta que debe devolver 0 filas para U sobre P_B
-- SET LOCAL role authenticated;
-- SET LOCAL request.jwt.claim.sub = 'USER_U_UUID';
-- SELECT * FROM patients WHERE id = 'PATIENT_B_UUID';

-- Resultado esperado: 0 filas (RLS oculta cross-tenant).

-- Paso 4: mismo usuario puede ver pacientes de su clínica A
-- SELECT count(*) FROM patients WHERE clinic_id = 'CLINIC_A_UUID';
-- Resultado esperado: >= 0 (según datos), sin filas de clínica B.

-- Documentación: docs/RLS_AUDIT.md
