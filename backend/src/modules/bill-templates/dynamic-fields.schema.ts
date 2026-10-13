import { z } from 'zod';

export const listDynamicFieldsSchema = z.object({
  query: z.object({
    source_entity: z
      .enum([
        'PARTY',
        'TRIP',
        'VEHICLE',
        'VEHICLE_OWNER',
        'JOURNEY',
        'RECEIVABLES',
        'VEHICLE_OWNER_PAYABLES',
        'OWN_FLEET_EXPENSES',
        'POD',
        'ISSUES',
        'BILLING',
        'PAYMENT',
        'SYSTEM',
        'CALCULATED'
      ])
      .optional(),
    search: z.string().optional(),
    is_repeatable: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional()
  }).optional()
});
