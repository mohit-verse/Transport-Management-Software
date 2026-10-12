import { z } from 'zod';

export const listPaymentsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
    payment_type: z.enum(['INCOMING', 'OUTGOING']).optional(),
    category: z.string().optional(),
    payment_mode: z.enum(['UPI', 'BANK_TRANSFER', 'CASH']).optional(),
    payment_status: z.enum(['ACTIVE', 'REVERSED']).optional(),
    party_id: z.string().uuid().optional(),
    vehicle_owner_id: z.string().uuid().optional(),
    trip_id: z.string().uuid().optional(),
    bill_id: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    sort_by: z.enum(['payment_date', 'created_at', 'amount']).optional().default('payment_date'),
    sort_order: z.enum(['ASC', 'DESC']).optional().default('DESC'),
  })
});

export const createPaymentSchema = z.object({
  body: z.object({
    payment_date: z.string(),
    payment_mode: z.enum(['UPI', 'BANK_TRANSFER', 'CASH']),
    amount: z.number().positive(),
    payment_direction: z.enum(['INCOMING', 'OUTGOING']),
    payment_category: z.enum([
      'COMPANY_PAYMENT',
      'MARKET_PARTY_PAYMENT',
      'OTHER_BUSINESS_RECEIPT',
      'VEHICLE_OWNER_PAYMENT',
      'OWN_FLEET_EXPENSE',
      'OTHER_BUSINESS_PAYMENT'
    ]),
    party_id: z.string().uuid().optional().nullable(),
    vehicle_owner_id: z.string().uuid().optional().nullable(),
    other_business_category_id: z.string().uuid().optional().nullable(),
    allocations: z.array(z.object({
      allocation_type: z.enum([
        'BILL',
        'TRIP',
        'CREDIT_GENERATED',
        'VEHICLE_OWNER',
        'OWN_FLEET_EXPENSE',
        'OTHER_BUSINESS'
      ]),
      allocated_amount: z.number().positive(),
      target_bill_id: z.string().uuid().optional().nullable(),
      target_trip_id: z.string().uuid().optional().nullable(),
      target_vehicle_owner_id: z.string().uuid().optional().nullable(),
      target_own_fleet_expense_detail_id: z.string().uuid().optional().nullable(),
    })).min(1)
  })
});

export const updatePaymentSchema = z.object({
  body: z.object({
    payment_date: z.string().optional(),
    payment_mode: z.enum(['UPI', 'BANK_TRANSFER', 'CASH']).optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
});

export const reallocatePaymentSchema = z.object({
  body: z.object({
    allocations: z.array(z.object({
      allocation_type: z.enum([
        'BILL',
        'TRIP',
        'CREDIT_GENERATED',
        'VEHICLE_OWNER',
        'OWN_FLEET_EXPENSE',
        'OTHER_BUSINESS'
      ]),
      allocated_amount: z.number().positive(),
      target_bill_id: z.string().uuid().optional().nullable(),
      target_trip_id: z.string().uuid().optional().nullable(),
      target_vehicle_owner_id: z.string().uuid().optional().nullable(),
      target_own_fleet_expense_detail_id: z.string().uuid().optional().nullable(),
    })).min(1),
    reason: z.string().min(3).optional()
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
    payment_id: z.string().uuid(),
    amount: z.number().positive().optional()
  })
});
