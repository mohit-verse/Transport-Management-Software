import { z } from 'zod';

export const generateBillSchema = z.object({
  body: z.object({
    party_id: z.string().uuid(),
    financial_year_id: z.string().uuid(),
    numbering_series_id: z.string().uuid(),
    billing_mode: z.enum(['INDIVIDUAL', 'CONSOLIDATED']),
    bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    trip_ids: z.array(z.string().uuid()).min(1),
    template_id: z.string().uuid().optional().nullable(),
    template_snapshot: z.record(z.any()),
    resolved_dynamic_fields: z.record(z.any()).optional().nullable()
  })
});

export const checkEligibilitySchema = z.object({
  body: z.object({
    party_id: z.string().uuid(),
    trip_ids: z.array(z.string().uuid()).min(1)
  })
});

export const cancelBillSchema = z.object({
  body: z.object({
    cancel_reason: z.string().min(5)
  })
});

export const createVersionSchema = z.object({
  body: z.object({
    template_id: z.string().uuid().optional().nullable(),
    template_snapshot: z.record(z.any()),
    resolved_dynamic_fields: z.record(z.any()).optional().nullable()
  })
});
