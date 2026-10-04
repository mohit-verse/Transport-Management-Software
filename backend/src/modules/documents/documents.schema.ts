
import { z } from 'zod';

export const uploadPODSchema = z.object({
  body: z.object({
    trip_id: z.string().uuid(),
    courier_docket_number: z.string().optional()
  })
});
