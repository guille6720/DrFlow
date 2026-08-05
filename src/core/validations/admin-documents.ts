import { z } from "zod";

import { entityIdSchema } from "@/core/validations/params";

export const adminDocumentUploadSchema = z.object({
  patient_id: entityIdSchema,
  category: z.string().min(1).max(80),
  title: z.string().max(200).optional(),
});
