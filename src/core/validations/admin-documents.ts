import { z } from "zod";

import { entityIdSchema } from "@/core/validations/params";

import { ADMIN_DOCUMENT_CATEGORIES } from "@/lib/constants/cash-register";

const adminDocumentCategories = ADMIN_DOCUMENT_CATEGORIES.map((c) => c.value) as [
  (typeof ADMIN_DOCUMENT_CATEGORIES)[number]["value"],
  ...(typeof ADMIN_DOCUMENT_CATEGORIES)[number]["value"][],
];

export const adminDocumentUploadSchema = z.object({
  patient_id: entityIdSchema,
  category: z.enum(adminDocumentCategories),
  title: z.string().max(200).optional(),
});
