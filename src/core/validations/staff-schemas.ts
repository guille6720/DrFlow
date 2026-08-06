import { z } from "zod";

export const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  full_name: z.string().min(2, "Nombre requerido"),
  role: z.enum(["clinic_admin", "doctor", "secretary"]),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "Contraseña demasiado larga"),
});
