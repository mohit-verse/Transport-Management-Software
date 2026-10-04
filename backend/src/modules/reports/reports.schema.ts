import { z } from 'zod';

export const reportQuerySchema = z.object({
  query: z.object({
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    financialYearId: z.string().uuid().optional(),
    partyId: z.string().uuid().optional(),
    vehicleOwnerId: z.string().uuid().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    pageSize: z.string().regex(/^\d+$/).transform(Number).optional(),
    q: z.string().optional(),
  })
});
