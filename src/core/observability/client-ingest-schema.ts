import { z } from "zod";

const clientEventSchema = z.object({
  category: z.enum(["error", "performance"]),
  name: z.string().min(1).max(120),
  status: z.enum(["ok", "warn", "error"]).optional(),
  path: z.string().max(512).optional(),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
  traceId: z.string().max(64).optional(),
  errorMessage: z.string().max(4000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const clientObservabilityBatchSchema = z.object({
  events: z.array(clientEventSchema).min(1).max(10),
});

export type ClientObservabilityEvent = z.infer<typeof clientEventSchema>;
