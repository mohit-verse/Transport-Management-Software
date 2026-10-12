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
    cancel_reason: z.string().min(5, 'Cancellation reason must be at least 5 characters')
  })
});

export const createVersionSchema = z.object({
  body: z.object({
    template_id: z.string().uuid().optional().nullable(),
    template_snapshot: z.record(z.any()),
    resolved_dynamic_fields: z.record(z.any()).optional().nullable(),
    items: z.array(z.object({
      trip_id: z.string().uuid().optional().nullable(),
      sequence_no: z.number().int().positive(),
      description: z.string().min(1),
      quantity: z.number().optional().nullable(),
      unit_price: z.number().optional().nullable(),
      line_amount: z.number().nonnegative()
    })).optional()
  })
});

export const listBillsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    party_id: z.string().uuid().optional(),
    bill_status: z.enum(['GENERATED', 'SUBMITTED', 'PAID', 'CANCELLED']).optional(),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
    financial_year_id: z.string().uuid().optional(),
    billing_mode: z.enum(['INDIVIDUAL', 'CONSOLIDATED']).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    sort_by: z.enum(['bill_date', 'bill_number', 'total_amount', 'created_at']).optional(),
    sort_order: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional()
  }).optional()
});

export const getEligibleTripsSchema = z.object({
  query: z.object({
    party_id: z.string().uuid('party_id must be a valid UUID')
  })
});

export const getNumberingSeriesSchema = z.object({
  query: z.object({
    party_id: z.string().uuid().optional(),
    financial_year_id: z.string().uuid().optional()
  }).optional()
});
