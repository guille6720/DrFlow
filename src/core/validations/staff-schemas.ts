import { z } from "zod";

export const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  full_name: z.string().min(2, "Nombre requerido"),
  role: z.enum(["clinic_admin", "doctor", "secretary"]),
});
