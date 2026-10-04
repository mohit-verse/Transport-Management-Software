
import { z } from 'zod';

export const createOwnerSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    mobile_number: z.string().min(10),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pan_number: z.string().optional(),
    bank_details: z.record(z.any()).optional(),
  })
});

export const updateOwnerSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    mobile_number: z.string().min(10).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pan_number: z.string().optional(),
    bank_details: z.record(z.any()).optional(),
  })
});
