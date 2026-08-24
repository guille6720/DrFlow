import { z } from "zod";

import { entityIdSchema } from "@/core/validations/params";

import type { Database } from "@/types/supabase";

const adminDocumentCategories = [
  "authorization",
  "medical_order",
  "patient_study",
  "general",
  "other",
] as const satisfies ReadonlyArray<Database["public"]["Enums"]["admin_document_category"]>;

export const adminDocumentUploadSchema = z.object({
  patient_id: entityIdSchema,
  category: z.enum(adminDocumentCategories),
  title: z.string().max(200).optional(),
});
