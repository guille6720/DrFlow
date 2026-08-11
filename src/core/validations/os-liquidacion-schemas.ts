import { z } from "zod";

import { entityIdSchema } from "@/core/validations/params";

export const osFeeScheduleSchema = z.object({
  insurance_provider: z.string().min(1, "Obra social requerida").max(80),
  practice_code: z.string().min(1).max(20).default("420101"),
  practice_label: z.string().min(1).max(120).default("Consulta médica"),
  amount: z.coerce.number().min(0, "Monto inválido"),
});

export const createOsLiquidationBatchSchema = z
  .object({
    insurance_provider: z.string().min(1, "Obra social requerida").max(80),
    period_from: z.string().min(1, "Fecha desde requerida"),
    period_to: z.string().min(1, "Fecha hasta requerida"),
  })
  .refine((data) => new Date(data.period_to) > new Date(data.period_from), {
    message: "La fecha hasta debe ser posterior al desde",
    path: ["period_to"],
  });

export const updateOsLiquidationStatusSchema = z.object({
  batch_id: entityIdSchema,
  status: z.enum(["submitted", "paid", "cancelled"]),
});

export const deleteOsFeeScheduleSchema = z.object({
  id: entityIdSchema,
});
