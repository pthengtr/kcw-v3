import { z } from "zod";

export const locationSchema = z.object({
  location_uuid: z.string().uuid().optional(),
  location_code: z.string().trim().min(1).max(50),
  location_name: z.string().trim().min(1).max(120),
  is_active: z.boolean().default(true),
});

export type LocationSchema = z.infer<typeof locationSchema>;
