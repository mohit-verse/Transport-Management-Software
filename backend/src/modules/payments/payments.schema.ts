
import { z } from 'zod';

export const createPaymentSchema = z.object({
  body: z.object({
    payment_date: z.string(),
    payment_mode: z.enum(['UPI', 'BANK_TRANSFER', 'CASH']),
    amount: z.number().positive(),
    payment_direction: z.enum(['INCOMING', 'OUTGOING']),
    payment_category: z.enum(['COMPANY_PAYMENT', 'MARKET_PARTY_PAYMENT', 'OTHER_BUSINESS_RECEIPT', 'VEHICLE_OWNER_PAYMENT', 'OWN_FLEET_EXPENSE', 'OTHER_BUSINESS_PAYMENT']),
    party_id: z.string().uuid().optional().nullable(),
    vehicle_owner_id: z.string().uuid().optional().nullable(),
    own_fleet_vehicle_id: z.string().uuid().optional().nullable(),
    reference_number: z.string().optional(),
    attachment_url: z.string().optional(),
    notes: z.string().optional(),
    allocations: z.array(z.object({
      allocation_type: z.enum(['BILL', 'TRIP', 'CREDIT_GENERATED', 'VEHICLE_OWNER', 'OWN_FLEET_EXPENSE', 'OTHER_BUSINESS']),
      allocated_amount: z.number().positive(),
      target_bill_id: z.string().uuid().optional().nullable(),
      target_trip_id: z.string().uuid().optional().nullable()
    })).min(1)
  })
});

export const updatePaymentSchema = z.object({
  body: z.object({
    payment_date: z.string().optional(),
    payment_mode: z.enum(['UPI', 'BANK_TRANSFER', 'CASH']).optional(),
    reference_number: z.string().optional(),
    attachment_url: z.string().optional(),
    notes: z.string().optional()
  })
});

export const reversePaymentSchema = z.object({
  body: z.object({
    reversal_reason: z.string().min(5)
  })
});

export const utilizeCreditSchema = z.object({
  body: z.object({
    party_credit_source_id: z.string().uuid(),
    target_trip_id: z.string().uuid().optional().nullable(),
    target_bill_id: z.string().uuid().optional().nullable(),
    payment_id: z.string().uuid().optional().nullable(),
    allocation_amount: z.number().positive()
  })
});

export const fifoAllocationSchema = z.object({
  body: z.object({
    party_id: z.string().uuid(),
    amount: z.number().positive(),
    payment_id: z.string().uuid().optional().nullable()
  })
});
