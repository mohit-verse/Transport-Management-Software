
import { z } from 'zod';

export const createPartySchema = z.object({
  body: z.object({
    party_type: z.enum(['COMPANY', 'MARKET_PARTY']),
    name: z.string().min(1),
    primary_mobile: z.string().min(10),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pin_code: z.string().optional(),
    gstin: z.string().optional(),
    pan_number: z.string().optional(),
    is_tds_applicable: z.boolean().default(false),
  })
});

export const updatePartySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    primary_mobile: z.string().min(10).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pin_code: z.string().optional(),
    gstin: z.string().optional(),
    pan_number: z.string().optional(),
    is_tds_applicable: z.boolean().optional(),
  })
});

export const updateBillingConfigSchema = z.object({
  body: z.object({
    billing_configuration: z.record(z.any())
  })
});
