import { z } from 'zod';

export const listNumberingSeriesSchema = z.object({
  query: z.object({
    party_id: z.string().uuid().optional(),
    financial_year_id: z.string().uuid().optional(),
    is_active: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional()
  }).optional()
});

export const createNumberingSeriesSchema = z.object({
  body: z.object({
    party_id: z.string().uuid(),
    financial_year_id: z.string().uuid(),
    series_code: z.string().min(1).max(50),
    prefix: z.string().min(1).max(50)
  })
});

export const updateNumberingSeriesSchema = z.object({
  body: z.object({
    series_code: z.string().min(1).max(50).optional(),
    prefix: z.string().min(1).max(50).optional(),
    is_active: z.boolean().optional()
  })
});
