
import { z } from 'zod';

export const createMvSchema = z.object({
  body: z.object({
    vehicle_number: z.string().min(1),
    vehicle_owner_id: z.string().uuid(),
    vehicle_type: z.string().optional()
  })
});

export const updateMvSchema = z.object({
  body: z.object({
    vehicle_number: z.string().min(1).optional(),
    vehicle_owner_id: z.string().uuid().optional(),
    vehicle_type: z.string().optional()
  })
});
