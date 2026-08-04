import { z } from "zod";

export const clinicalIndicatorsSchema = z.object({
  weightKg: z.coerce.number().min(0).max(500).nullable().optional(),
  heightCm: z.coerce.number().min(0).max(300).nullable().optional(),
  creatinineMgDl: z.coerce.number().min(0).max(50).nullable().optional(),
  cigarettesPerDay: z.coerce.number().int().min(0).max(200).nullable().optional(),
  smokingYears: z.coerce.number().int().min(0).max(100).nullable().optional(),
  cardiovascularRisk: z.enum(["low", "moderate", "high"]).nullable().optional(),
});

export type ClinicalIndicatorsValidated = z.infer<typeof clinicalIndicatorsSchema>;
