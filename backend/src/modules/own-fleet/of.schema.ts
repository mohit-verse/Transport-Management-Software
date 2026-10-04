
import { z } from 'zod';

export const createOfSchema = z.object({
  body: z.object({
    vehicle_number: z.string().min(1),
    vehicle_type: z.string().optional(),
    capacity_tonnage: z.number().optional(),
    purchase_date: z.string().optional(),
  })
});

export const updateOfSchema = z.object({
  body: z.object({
    vehicle_number: z.string().min(1).optional(),
    vehicle_type: z.string().optional(),
    capacity_tonnage: z.number().optional(),
    purchase_date: z.string().optional(),
  })
});
