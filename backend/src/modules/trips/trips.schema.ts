
import { z } from 'zod';

export const createTripSchema = z.object({
  body: z.object({
    trip_type: z.enum(['COMPANY', 'MARKET']),
    vehicle_relationship: z.enum(['MARKET', 'OWN_FLEET']),
    party_id: z.string().uuid(),
    vehicle_owner_id: z.string().uuid().nullable().optional(),
    market_vehicle_id: z.string().uuid().nullable().optional(),
    own_fleet_vehicle_id: z.string().uuid().nullable().optional(),
    driver_name: z.string().optional(),
    driver_mobile: z.string().optional(),
    trip_date: z.string(),
    destinations: z.array(z.object({
      origin: z.string(),
      destination: z.string()
    })).min(1)
  })
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['CREATED', 'LOADING', 'IN_TRANSIT', 'COMPLETED', 'SETTLED', 'CANCELLED'])
  })
});

export const updateFinancialsSchema = z.object({
  body: z.object({
    freight_amount: z.number().optional(),
    detention_amount: z.number().optional(),
    tds_amount: z.number().optional(),
    other_charges: z.array(z.any()).optional(),
    deductions: z.array(z.any()).optional(),
    unloading_charges: z.array(z.any()).optional()
  })
});

export const createIssueSchema = z.object({
  body: z.object({
    issue_type: z.enum(['SHORTAGE', 'DAMAGE', 'OTHER']),
    description: z.string()
  })
});
