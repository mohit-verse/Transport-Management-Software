
import { z } from 'zod';

export const uploadPODSchema = z.object({
  body: z.object({
    trip_id: z.string().uuid(),
    courier_docket_number: z.string().optional()
  })
});

export const uploadOwnFleetDocSchema = z.object({
  body: z.object({
    vehicle_id: z.string().uuid(),
    document_type: z.string().min(1),
    expiry_date: z.string().optional() // Expected format YYYY-MM-DD
  })
});
