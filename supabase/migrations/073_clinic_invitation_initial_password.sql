-- Contraseña inicial definida por el admin al invitar (visible solo a administradores del consultorio)

ALTER TABLE public.clinic_invitations
  ADD COLUMN IF NOT EXISTS initial_password TEXT;

COMMENT ON COLUMN public.clinic_invitations.initial_password IS
  'Contraseña inicial enviada al invitado. Solo lectura para administradores del consultorio.';
