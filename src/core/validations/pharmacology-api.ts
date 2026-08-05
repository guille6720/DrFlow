import { z } from "zod";

import {
  entityIdArraySchema,
  entityIdSchema,
  pharmacologySearchTypeSchema,
  searchQuerySchema,
} from "@/core/validations/params";

export const pharmacologyApiQuerySchema = z
  .object({
    q: searchQuerySchema.optional(),
    pathologyId: entityIdSchema.optional(),
    symptomIds: entityIdArraySchema.optional(),
    type: pharmacologySearchTypeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const modes = [
      Boolean(data.pathologyId),
      Boolean(data.symptomIds?.length),
      Boolean(data.q && data.q.length >= 2),
    ].filter(Boolean).length;
    if (modes > 1) {
      ctx.addIssue({ code: "custom", message: "Parámetros de búsqueda incompatibles" });
    }
  });
