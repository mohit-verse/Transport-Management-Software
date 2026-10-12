import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import Decimal from 'decimal.js';

function generatePaymentId() {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PAY-${dateStr}-${rand}`;
}

export interface PaymentListFilters {
  search?: string;
  from_date?: string;
  to_date?: string;
  payment_type?: 'INCOMING' | 'OUTGOING';
  category?: string;
  payment_mode?: 'UPI' | 'BANK_TRANSFER' | 'CASH';
  payment_status?: 'ACTIVE' | 'REVERSED';
  party_id?: string;
  vehicle_owner_id?: string;
  trip_id?: string;
  bill_id?: string;
  page?: number;
  limit?: number;
  sort_by?: 'payment_date' | 'created_at' | 'amount';
  sort_order?: 'ASC' | 'DESC';
}

export const listPayments = async (filters: PaymentListFilters) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 20;
  const offset = (page - 1) * limit;
  const sortBy = filters.sort_by || 'payment_date';
  const sortOrder = filters.sort_order === 'ASC' ? 'ASC' : 'DESC';

  let whereClauses: string[] = [];
  let params: any[] = [];
  let paramIdx = 1;

  if (filters.search) {
    whereClauses.push(`(p.payment_id ILIKE $${paramIdx} OR pr.name ILIKE $${paramIdx} OR vo.name ILIKE $${paramIdx} OR obc.category_name ILIKE $${paramIdx})`);
    params.push(`%${filters.search}%`);
    paramIdx++;
  }

  if (filters.from_date) {
    whereClauses.push(`p.payment_date >= $${paramIdx}`);
    params.push(filters.from_date);
    paramIdx++;
  }

  if (filters.to_date) {
    whereClauses.push(`p.payment_date <= $${paramIdx}`);
    params.push(filters.to_date);
    paramIdx++;
  }

  if (filters.payment_type) {
    whereClauses.push(`p.payment_type = $${paramIdx}`);
    params.push(filters.payment_type);
    paramIdx++;
  }

  if (filters.category) {
    whereClauses.push(`p.category = $${paramIdx}`);
    params.push(filters.category);
    paramIdx++;
  }

  if (filters.payment_mode) {
    whereClauses.push(`p.payment_mode = $${paramIdx}`);
    params.push(filters.payment_mode);
    paramIdx++;
  }

  if (filters.payment_status) {
    whereClauses.push(`p.payment_status = $${paramIdx}`);
    params.push(filters.payment_status);
    paramIdx++;
  }

  if (filters.party_id) {
    whereClauses.push(`p.party_id = $${paramIdx}`);
    params.push(filters.party_id);
    paramIdx++;
  }

  if (filters.vehicle_owner_id) {
    whereClauses.push(`p.vehicle_owner_id = $${paramIdx}`);
    params.push(filters.vehicle_owner_id);
    paramIdx++;
  }

  if (filters.trip_id) {
    whereClauses.push(`EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.trip_id = $${paramIdx})`);
    params.push(filters.trip_id);
    paramIdx++;
  }

  if (filters.bill_id) {
    whereClauses.push(`EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.bill_id = $${paramIdx})`);
    params.push(filters.bill_id);
    paramIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) AS total
    FROM payments p
    LEFT JOIN parties pr ON p.party_id = pr.id
    LEFT JOIN vehicle_owners vo ON p.vehicle_owner_id = vo.id
    LEFT JOIN other_business_categories obc ON p.other_business_category_id = obc.id
    ${whereSql}
  `;
  const countRes = await query(countSql, params);
  const total = countRes.rows?.[0]?.total ? parseInt(countRes.rows[0].total, 10) : 0;

  const dataSql = `
    SELECT 
      p.id,
      p.payment_id,
      p.payment_date,
      p.payment_type,
      p.category,
      p.amount,
      p.payment_mode,
      p.payment_status,
      p.reversal_reason,
      p.reversed_by,
      p.reversed_at,
      p.created_by,
      p.created_at,
      p.updated_at,
      p.party_id,
      pr.name AS party_name,
      p.vehicle_owner_id,
      vo.name AS vehicle_owner_name,
      p.other_business_category_id,
      obc.category_name AS other_business_category_name
    FROM payments p
    LEFT JOIN parties pr ON p.party_id = pr.id
    LEFT JOIN vehicle_owners vo ON p.vehicle_owner_id = vo.id
    LEFT JOIN other_business_categories obc ON p.other_business_category_id = obc.id
    ${whereSql}
    ORDER BY p.${sortBy} ${sortOrder}, p.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;
  params.push(limit, offset);

  const dataRes = await query(dataSql, params);

  return {
    data: dataRes.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

export const getPaymentById = async (id: string) => {
  const pSql = `
    SELECT 
      p.*,
      pr.name AS party_name,
      pr.party_type AS party_type,
      vo.name AS vehicle_owner_name,
      obc.category_name AS other_business_category_name,
      obc.category_type AS other_business_category_type,
      u.name AS creator_name,
      ru.name AS reverser_name
    FROM payments p
    LEFT JOIN parties pr ON p.party_id = pr.id
    LEFT JOIN vehicle_owners vo ON p.vehicle_owner_id = vo.id
    LEFT JOIN other_business_categories obc ON p.other_business_category_id = obc.id
    LEFT JOIN users u ON p.created_by = u.id
    LEFT JOIN users ru ON p.reversed_by = ru.id
    WHERE p.id = $1
  `;
  const pRes = await query(pSql, [id]);
  if (pRes.rowCount === 0) {
    throw new AppError('NOT_FOUND', 'Payment not found', 404);
  }
  const payment = pRes.rows[0];

  // Allocations with joined target details
  const allocSql = `
    SELECT 
      pa.*,
      b.bill_number,
      t.trip_number,
      vo.name AS vehicle_owner_name,
      ofed.expense_category AS own_fleet_expense_category,
      ofed.charge_name AS own_fleet_expense_charge_name,
      pc.id AS credit_id
    FROM payment_allocations pa
    LEFT JOIN bills b ON pa.bill_id = b.id
    LEFT JOIN trips t ON pa.trip_id = t.id
    LEFT JOIN vehicle_owners vo ON pa.vehicle_owner_id = vo.id
    LEFT JOIN own_fleet_expense_details ofed ON pa.own_fleet_expense_detail_id = ofed.id
    LEFT JOIN party_credits pc ON pa.id = pc.credit_allocation_id
    WHERE pa.payment_id = $1
    ORDER BY pa.created_at ASC
  `;
  const allocRes = await query(allocSql, [id]);

  // FIFO runs
  const fifoSql = `
    SELECT 
      r.id AS run_id,
      r.run_number,
      r.run_status,
      r.created_at AS run_created_at,
      ra.id AS allocation_ref_id,
      ra.allocation_id,
      ra.target_trip_id,
      ra.target_bill_id,
      ra.allocation_sequence,
      ra.receivable_before,
      ra.receivable_after,
      b.bill_number,
      t.trip_number
    FROM payment_fifo_runs r
    LEFT JOIN payment_fifo_run_allocations ra ON ra.fifo_run_id = r.id
    LEFT JOIN bills b ON ra.target_bill_id = b.id
    LEFT JOIN trips t ON ra.target_trip_id = t.id
    WHERE r.payment_id = $1
    ORDER BY r.run_number ASC, ra.allocation_sequence ASC
  `;
  const fifoRes = await query(fifoSql, [id]);

  // Documents
  const docSql = `
    SELECT 
      d.id,
      d.document_type,
      d.original_name,
      d.mime_type,
      d.file_size_bytes,
      d.uploaded_at,
      d.uploaded_by,
      u.name AS uploader_name
    FROM documents d
    JOIN document_links dl ON dl.document_id = d.id
    LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE dl.entity_type = 'PAYMENT' AND dl.entity_id = $1 AND d.is_deleted = false
    ORDER BY d.uploaded_at DESC
  `;
  const docRes = await query(docSql, [id]);

  // Audit history
  const auditSql = `
    SELECT 
      a.id,
      a.action_type,
      a.event_time,
      a.actor_user_id,
      u.name AS actor_name,
      a.before_state,
      a.after_state
    FROM audit_events a
    LEFT JOIN users u ON a.actor_user_id = u.id
    WHERE a.entity_id = $1
    ORDER BY a.event_time ASC
  `;
  const auditRes = await query(auditSql, [id]);

  return {
    ...payment,
    allocations: allocRes.rows,
    fifo_runs: fifoRes.rows,
    documents: docRes.rows,
    audit_history: auditRes.rows
  };
};

export const createPayment = async (data: any, userId: string) => {
  return withTransaction(async (client) => {
    // 1. Completeness Check Application Side
    let totalAlloc = new Decimal(0);
    for (const alloc of data.allocations) {
      if (alloc.allocation_type !== 'CREDIT_UTILIZED') {
        totalAlloc = totalAlloc.plus(new Decimal(alloc.allocated_amount));
      }
    }
    
    if (!totalAlloc.equals(new Decimal(data.amount))) {
      throw new AppError('PAYMENT_INTEGRITY_VIOLATION', 'Allocations must exactly equal payment amount.', 422);
    }

    // 2. Validate Other Business Category requirement
    if (['OTHER_BUSINESS_RECEIPT', 'OTHER_BUSINESS_PAYMENT'].includes(data.payment_category)) {
      if (!data.other_business_category_id) {
        throw new AppError('VALIDATION_ERROR', 'other_business_category_id is required for other business payments/receipts.', 400);
      }
    }

    // 3. Insert Payment
    const paymentIdStr = generatePaymentId();
    const pSql = `
      INSERT INTO payments (
        payment_id, payment_date, payment_mode, amount, payment_type, category,
        other_business_category_id, party_id, vehicle_owner_id, payment_status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10)
      RETURNING *
    `;
    const pParams = [
      paymentIdStr,
      data.payment_date,
      data.payment_mode,
      data.amount,
      data.payment_direction,
      data.payment_category,
      data.other_business_category_id || null,
      data.party_id || null,
      data.vehicle_owner_id || null,
      userId
    ];
    
    const pRes = await client.query(pSql, pParams);
    const payment = pRes.rows[0];

    // 4. Insert Allocations
    for (const alloc of data.allocations) {
      let targetBillId = null;
      let targetTripId = null;
      let targetVehicleOwnerId = null;
      let targetOwnFleetExpenseId = null;

      if (alloc.allocation_type === 'BILL') {
        targetBillId = alloc.target_bill_id || null;
      } else if (alloc.allocation_type === 'TRIP') {
        targetTripId = alloc.target_trip_id || null;
      } else if (alloc.allocation_type === 'VEHICLE_OWNER') {
        targetVehicleOwnerId = alloc.target_vehicle_owner_id || data.vehicle_owner_id || null;
      } else if (alloc.allocation_type === 'OWN_FLEET_EXPENSE') {
        targetOwnFleetExpenseId = alloc.target_own_fleet_expense_detail_id || null;
      }

      const aSql = `
        INSERT INTO payment_allocations (
          payment_id, allocation_type, allocation_amount, bill_id, trip_id,
          vehicle_owner_id, own_fleet_expense_detail_id, allocation_status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8)
        RETURNING *
      `;
      const aRes = await client.query(aSql, [
        payment.id,
        alloc.allocation_type,
        alloc.allocated_amount,
        targetBillId,
        targetTripId,
        targetVehicleOwnerId,
        targetOwnFleetExpenseId,
        userId
      ]);
      const insertedAlloc = aRes.rows[0];

      // Handle Credit Generation
      if (alloc.allocation_type === 'CREDIT_GENERATED') {
        if (!data.party_id) {
          throw new AppError('PAYMENT_INTEGRITY_VIOLATION', 'Credit generation requires a party.', 422);
        }
        const cSql = `INSERT INTO party_credits (party_id, payment_id, credit_allocation_id) VALUES ($1, $2, $3) RETURNING *`;
        await client.query(cSql, [data.party_id, payment.id, insertedAlloc.id]);
      }

      // Record allocation history
      await client.query(`
        INSERT INTO payment_allocation_history (allocation_id, event_type, previous_amount, new_amount, event_by, reason)
        VALUES ($1, 'CREATED', NULL, $2, $3, 'Initial payment allocation')
      `, [insertedAlloc.id, alloc.allocated_amount, userId]);
    }

    await createAudit({ entityType: 'PAYMENT', entityId: payment.id, action: 'CREATE', newState: payment, userId }, client);
    return payment;
  });
};

export const editPayment = async (id: string, data: any, userId: string) => {
  return withTransaction(async (client) => {
    const existingRes = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) throw new AppError('NOT_FOUND', 'Payment not found', 404);
    const existing = existingRes.rows[0];

    if (existing.payment_status === 'REVERSED') {
      throw new AppError('IMMUTABLE_RECORD', 'Cannot edit a reversed payment.', 409);
    }

    // Only mutable approved columns from schema: payment_date, payment_mode
    const allowedFields = ['payment_date', 'payment_mode'];
    const fields = Object.keys(data).filter(k => allowedFields.includes(k) && data[k] !== undefined);
    if (fields.length === 0) return existing;

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map(f => data[f]);
    const sql = `UPDATE payments SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    
    const res = await client.query(sql, [id, ...values]);
    const updated = res.rows[0];

    await createAudit({ entityType: 'PAYMENT', entityId: id, action: 'UPDATE', previousState: existing, newState: updated, userId }, client);
    return updated;
  });
};

export const reallocatePayment = async (id: string, data: any, userId: string) => {
  return withTransaction(async (client) => {
    const existingRes = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) throw new AppError('NOT_FOUND', 'Payment not found', 404);
    const payment = existingRes.rows[0];

    if (payment.payment_status === 'REVERSED') {
      throw new AppError('IMMUTABLE_RECORD', 'Cannot reallocate a reversed payment.', 409);
    }

    // Validate completeness of new allocations
    let totalAlloc = new Decimal(0);
    for (const alloc of data.allocations) {
      if (alloc.allocation_type !== 'CREDIT_UTILIZED') {
        totalAlloc = totalAlloc.plus(new Decimal(alloc.allocated_amount));
      }
    }
    if (!totalAlloc.equals(new Decimal(payment.amount))) {
      throw new AppError('PAYMENT_INTEGRITY_VIOLATION', 'New allocations must exactly equal payment amount.', 422);
    }

    // Check existing credit utilization dependency
    const existingGenCredit = await client.query(`
      SELECT pa.id, pa.allocation_amount,
             COALESCE((
               SELECT SUM(u.allocation_amount) 
               FROM payment_allocations u 
               WHERE u.party_credit_source_id = pa.id 
                 AND u.allocation_type = 'CREDIT_UTILIZED' 
                 AND u.allocation_status = 'ACTIVE'
             ), 0) AS utilized_amount
      FROM payment_allocations pa
      WHERE pa.payment_id = $1 AND pa.allocation_type = 'CREDIT_GENERATED' AND pa.allocation_status = 'ACTIVE'
    `, [id]);

    let previouslyUtilized = new Decimal(0);
    if (existingGenCredit.rows && existingGenCredit.rows.length > 0 && existingGenCredit.rows[0]) {
      previouslyUtilized = new Decimal(existingGenCredit.rows[0].utilized_amount || 0);
    }

    let newGenCreditAmount = new Decimal(0);
    for (const alloc of data.allocations) {
      if (alloc.allocation_type === 'CREDIT_GENERATED') {
        newGenCreditAmount = newGenCreditAmount.plus(new Decimal(alloc.allocated_amount));
      }
    }

    if (previouslyUtilized.greaterThan(newGenCreditAmount)) {
      throw new AppError('PAYMENT_INTEGRITY_VIOLATION', 'Cannot reduce generated credit below already utilized credit amount.', 422);
    }

    // Reverse existing active allocations
    const oldAllocsRes = await client.query(`
      SELECT * FROM payment_allocations 
      WHERE payment_id = $1 AND allocation_status = 'ACTIVE' AND allocation_type <> 'CREDIT_UTILIZED'
    `, [id]);

    for (const oldAlloc of oldAllocsRes.rows) {
      await client.query(`
        UPDATE payment_allocations SET allocation_status = 'REVERSED', reversed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [oldAlloc.id]);

      await client.query(`
        INSERT INTO payment_allocation_history (allocation_id, event_type, previous_amount, new_amount, event_by, reason)
        VALUES ($1, 'REALLOCATED', $2, 0, $3, $4)
      `, [oldAlloc.id, oldAlloc.allocation_amount, userId, data.reason || 'Payment reallocation']);
    }

    // Insert new active allocations
    for (const alloc of data.allocations) {
      let targetBillId = null;
      let targetTripId = null;
      let targetVehicleOwnerId = null;
      let targetOwnFleetExpenseId = null;

      if (alloc.allocation_type === 'BILL') {
        targetBillId = alloc.target_bill_id || null;
      } else if (alloc.allocation_type === 'TRIP') {
        targetTripId = alloc.target_trip_id || null;
      } else if (alloc.allocation_type === 'VEHICLE_OWNER') {
        targetVehicleOwnerId = alloc.target_vehicle_owner_id || payment.vehicle_owner_id || null;
      } else if (alloc.allocation_type === 'OWN_FLEET_EXPENSE') {
        targetOwnFleetExpenseId = alloc.target_own_fleet_expense_detail_id || null;
      }

      const aSql = `
        INSERT INTO payment_allocations (
          payment_id, allocation_type, allocation_amount, bill_id, trip_id,
          vehicle_owner_id, own_fleet_expense_detail_id, allocation_status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8)
        RETURNING *
      `;
      const aRes = await client.query(aSql, [
        payment.id,
        alloc.allocation_type,
        alloc.allocated_amount,
        targetBillId,
        targetTripId,
        targetVehicleOwnerId,
        targetOwnFleetExpenseId,
        userId
      ]);
      const insertedAlloc = aRes.rows[0];

      if (alloc.allocation_type === 'CREDIT_GENERATED') {
        // If party_credits already exists for this payment, update pointer
        const pcExist = await client.query('SELECT id FROM party_credits WHERE payment_id = $1', [payment.id]);
        if (pcExist.rowCount && pcExist.rowCount > 0) {
          await client.query('UPDATE party_credits SET credit_allocation_id = $1 WHERE payment_id = $2', [insertedAlloc.id, payment.id]);
        } else {
          await client.query('INSERT INTO party_credits (party_id, payment_id, credit_allocation_id) VALUES ($1, $2, $3)', [payment.party_id, payment.id, insertedAlloc.id]);
        }
      }

      await client.query(`
        INSERT INTO payment_allocation_history (allocation_id, event_type, previous_amount, new_amount, event_by, reason)
        VALUES ($1, 'REALLOCATED', 0, $2, $3, $4)
      `, [insertedAlloc.id, alloc.allocated_amount, userId, data.reason || 'Payment reallocation']);
    }

    await createAudit({
      entityType: 'PAYMENT',
      entityId: payment.id,
      action: 'REALLOCATE',
      previousState: { allocations: oldAllocsRes.rows },
      newState: { allocations: data.allocations },
      userId
    }, client);

    return payment;
  });
};

export const reversePayment = async (id: string, reason: string, userId: string) => {
  return withTransaction(async (client) => {
    const existingRes = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) throw new AppError('NOT_FOUND', 'Payment not found', 404);
    const payment = existingRes.rows[0];

    if (payment.payment_status === 'REVERSED') {
      throw new AppError('IMMUTABLE_RECORD', 'Payment is already reversed.', 409);
    }

    // Mark payment reversed
    const rSql = `UPDATE payments SET payment_status = 'REVERSED', reversed_by = $2, reversed_at = NOW(), reversal_reason = $3, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const res = await client.query(rSql, [id, userId, reason]);
    const updatedPayment = res.rows[0];

    // Mark all active allocations reversed
    await client.query(`
      UPDATE payment_allocations 
      SET allocation_status = 'REVERSED', reversed_at = NOW(), updated_at = NOW() 
      WHERE payment_id = $1 AND allocation_status = 'ACTIVE'
    `, [id]);

    await createAudit({ entityType: 'PAYMENT', entityId: id, action: 'REVERSE', previousState: payment, newState: updatedPayment, userId }, client);
    return updatedPayment;
  });
};

export const utilizeCredit = async (data: any, userId: string) => {
  return withTransaction(async (client) => {
    const origAllocRes = await client.query(
      'SELECT allocation_amount, payment_id FROM payment_allocations WHERE id = $1 AND allocation_type = $2 AND allocation_status = $3',
      [data.party_credit_source_id, 'CREDIT_GENERATED', 'ACTIVE']
    );
    if (origAllocRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Active CREDIT_GENERATED allocation not found', 404);
    }

    const utilsRes = await client.query(
      "SELECT COALESCE(SUM(allocation_amount), 0) as utilized_amount FROM payment_allocations WHERE party_credit_source_id = $1 AND allocation_type = 'CREDIT_UTILIZED' AND allocation_status = 'ACTIVE'",
      [data.party_credit_source_id]
    );

    const available = new Decimal(origAllocRes.rows[0].allocation_amount).minus(new Decimal(utilsRes.rows[0].utilized_amount));
    const requested = new Decimal(data.allocation_amount);

    if (requested.greaterThan(available)) {
      throw new AppError('PAYMENT_INTEGRITY_VIOLATION', 'Requested utilization exceeds available credit.', 422);
    }

    const pId = data.payment_id || origAllocRes.rows[0].payment_id;
    const aSql = `
      INSERT INTO payment_allocations (
        payment_id, allocation_type, allocation_amount, bill_id, trip_id,
        party_credit_source_id, allocation_status, created_by
      )
      VALUES ($1, 'CREDIT_UTILIZED', $2, $3, $4, $5, 'ACTIVE', $6)
      RETURNING *
    `;
    const aRes = await client.query(aSql, [
      pId,
      data.allocation_amount,
      data.target_bill_id || null,
      data.target_trip_id || null,
      data.party_credit_source_id,
      userId
    ]);
    const allocation = aRes.rows[0];

    await createAudit({ entityType: 'CREDIT_UTILIZATION', entityId: allocation.id, action: 'CREATE', newState: allocation, userId }, client);
    return allocation;
  });
};

export const fifoAllocation = async (data: any, userId: string) => {
  return withTransaction(async (client) => {
    const pId = data.payment_id;
    if (!pId) throw new AppError('BUSINESS_RULE_VIOLATION', 'Payment ID required for FIFO allocation.', 422);

    const pRes = await client.query('SELECT * FROM payments WHERE id = $1', [pId]);
    if (pRes.rowCount === 0) throw new AppError('NOT_FOUND', 'Payment not found', 404);
    const payment = pRes.rows[0];

    if (payment.payment_status === 'REVERSED') {
      throw new AppError('IMMUTABLE_RECORD', 'Cannot run FIFO on a reversed payment.', 409);
    }
    if (payment.payment_type !== 'INCOMING' || !['COMPANY_PAYMENT', 'MARKET_PARTY_PAYMENT'].includes(payment.category)) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'FIFO allocation is only applicable to incoming party payments.', 422);
    }
    if (payment.party_id !== data.party_id) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Party ID does not match payment party.', 422);
    }

    // Check if payment already has active allocations
    const existingActive = await client.query(`
      SELECT COALESCE(SUM(allocation_amount), 0) AS total_active 
      FROM payment_allocations 
      WHERE payment_id = $1 AND allocation_status = 'ACTIVE' AND allocation_type <> 'CREDIT_UTILIZED'
    `, [pId]);
    const totalActive = existingActive.rows?.[0]?.total_active || 0;
    if (new Decimal(totalActive).equals(new Decimal(payment.amount))) {
      throw new AppError('PAYMENT_INTEGRITY_VIOLATION', 'Payment is already fully allocated. Use reallocation if needed.', 422);
    }

    let remainingPayment = new Decimal(data.amount || payment.amount);

    // 1. Fetch eligible unpaid bills in chronological order
    const billsRes = await client.query(`
      SELECT id AS bill_id, NULL::uuid AS trip_id, bill_date AS obligation_date, balance_amount AS outstanding_amount
      FROM bills
      WHERE party_id = $1 AND bill_status IN ('GENERATED', 'SUBMITTED') AND balance_amount > 0
      ORDER BY bill_date ASC, created_at ASC
    `, [payment.party_id]);

    // 2. Fetch eligible unbilled completed trips in chronological order
    const tripsRes = await client.query(`
      SELECT NULL::uuid AS bill_id, t.id AS trip_id, t.trip_date AS obligation_date,
        (pf.receivable_amount - COALESCE((
          SELECT SUM(pa.allocation_amount) 
          FROM payment_allocations pa 
          WHERE pa.trip_id = t.id AND pa.allocation_type = 'TRIP' AND pa.allocation_status = 'ACTIVE'
        ), 0)) AS outstanding_amount
      FROM trips t
      JOIN trip_party_financials pf ON pf.trip_id = t.id
      WHERE t.party_id = $1 AND t.status != 'CANCELLED'
        AND NOT EXISTS (
          SELECT 1 FROM bill_items bi 
          JOIN bills b ON bi.bill_id = b.id 
          WHERE bi.trip_id = t.id AND b.bill_status != 'CANCELLED'
        )
      ORDER BY t.trip_date ASC, t.created_at ASC
    `, [payment.party_id]);

    const candidateTrips = tripsRes.rows.filter(r => new Decimal(r.outstanding_amount).greaterThan(0));

    // Combine and sort chronologically
    const obligations = [...billsRes.rows, ...candidateTrips].sort((a, b) => {
      const da = new Date(a.obligation_date).getTime();
      const db = new Date(b.obligation_date).getTime();
      return da - db;
    });

    // Create FIFO run
    const nextRunRes = await client.query(
      'SELECT COALESCE(MAX(run_number), 0) + 1 AS next_run FROM payment_fifo_runs WHERE payment_id = $1',
      [pId]
    );
    const runNumber = nextRunRes.rows[0].next_run;

    const rSql = `INSERT INTO payment_fifo_runs (payment_id, run_number, run_status, created_by) VALUES ($1, $2, 'COMPLETED', $3) RETURNING *`;
    const rRes = await client.query(rSql, [pId, runNumber, userId]);
    const run = rRes.rows[0];

    let sequenceNo = 1;
    const createdAllocations: any[] = [];

    for (const ob of obligations) {
      if (remainingPayment.lessThanOrEqualTo(0)) break;

      const outstanding = new Decimal(ob.outstanding_amount);
      const allocAmount = Decimal.min(remainingPayment, outstanding);

      const isBill = !!ob.bill_id;
      const allocType = isBill ? 'BILL' : 'TRIP';

      const aSql = `
        INSERT INTO payment_allocations (
          payment_id, allocation_type, allocation_amount, bill_id, trip_id, allocation_status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
        RETURNING *
      `;
      const aRes = await client.query(aSql, [
        pId,
        allocType,
        allocAmount.toNumber(),
        ob.bill_id,
        ob.trip_id,
        userId
      ]);
      const insertedAlloc = aRes.rows[0];
      createdAllocations.push(insertedAlloc);

      await client.query(`
        INSERT INTO payment_fifo_run_allocations (
          fifo_run_id, allocation_id, target_trip_id, target_bill_id,
          allocation_sequence, receivable_before, receivable_after
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        run.id,
        insertedAlloc.id,
        ob.trip_id,
        ob.bill_id,
        sequenceNo++,
        outstanding.toNumber(),
        outstanding.minus(allocAmount).toNumber()
      ]);

      await client.query(`
        INSERT INTO payment_allocation_history (allocation_id, event_type, previous_amount, new_amount, event_by, reason)
        VALUES ($1, 'FIFO_ALLOCATED', 0, $2, $3, 'Automated FIFO allocation')
      `, [insertedAlloc.id, allocAmount.toNumber(), userId]);

      remainingPayment = remainingPayment.minus(allocAmount);
    }

    // Excess becomes CREDIT_GENERATED
    if (remainingPayment.greaterThan(0)) {
      const cSql = `
        INSERT INTO payment_allocations (
          payment_id, allocation_type, allocation_amount, allocation_status, created_by
        )
        VALUES ($1, 'CREDIT_GENERATED', $2, 'ACTIVE', $3)
        RETURNING *
      `;
      const cRes = await client.query(cSql, [pId, remainingPayment.toNumber(), userId]);
      const creditAlloc = cRes.rows[0];
      createdAllocations.push(creditAlloc);

      await client.query(
        'INSERT INTO party_credits (party_id, payment_id, credit_allocation_id) VALUES ($1, $2, $3)',
        [payment.party_id, pId, creditAlloc.id]
      );

      await client.query(`
        INSERT INTO payment_fifo_run_allocations (
          fifo_run_id, allocation_id, target_trip_id, target_bill_id,
          allocation_sequence, receivable_before, receivable_after
        )
        VALUES ($1, $2, NULL, NULL, $3, 0, 0)
      `, [run.id, creditAlloc.id, sequenceNo++]);

      await client.query(`
        INSERT INTO payment_allocation_history (allocation_id, event_type, previous_amount, new_amount, event_by, reason)
        VALUES ($1, 'FIFO_ALLOCATED', 0, $2, $3, 'Excess payment generated as party credit via FIFO')
      `, [creditAlloc.id, remainingPayment.toNumber(), userId]);
    }

    await createAudit({ entityType: 'FIFO_RUN', entityId: run.id, action: 'CREATE', newState: { run, allocations: createdAllocations }, userId }, client);

    return {
      run,
      allocations: createdAllocations
    };
  });
};

export const getPaymentFifoRuns = async (paymentId: string) => {
  const pRes = await query('SELECT id FROM payments WHERE id = $1', [paymentId]);
  if (pRes.rowCount === 0) throw new AppError('NOT_FOUND', 'Payment not found', 404);

  const sql = `
    SELECT 
      r.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ra.id,
            'allocation_id', ra.allocation_id,
            'target_trip_id', ra.target_trip_id,
            'target_bill_id', ra.target_bill_id,
            'allocation_sequence', ra.allocation_sequence,
            'receivable_before', ra.receivable_before,
            'receivable_after', ra.receivable_after,
            'bill_number', b.bill_number,
            'trip_number', t.trip_number
          ) ORDER BY ra.allocation_sequence ASC
        ) FILTER (WHERE ra.id IS NOT NULL),
        '[]'
      ) AS allocations
    FROM payment_fifo_runs r
    LEFT JOIN payment_fifo_run_allocations ra ON ra.fifo_run_id = r.id
    LEFT JOIN bills b ON ra.target_bill_id = b.id
    LEFT JOIN trips t ON ra.target_trip_id = t.id
    WHERE r.payment_id = $1
    GROUP BY r.id
    ORDER BY r.run_number ASC
  `;
  const res = await query(sql, [paymentId]);
  return res.rows;
};

export const getPaymentAuditHistory = async (paymentId: string) => {
  const pRes = await query('SELECT id FROM payments WHERE id = $1', [paymentId]);
  if (pRes.rowCount === 0) throw new AppError('NOT_FOUND', 'Payment not found', 404);

  const sql = `
    SELECT 
      a.id,
      a.action_type,
      a.event_time,
      a.actor_user_id,
      u.name AS actor_name,
      a.before_state,
      a.after_state
    FROM audit_events a
    LEFT JOIN users u ON a.actor_user_id = u.id
    WHERE a.entity_id = $1
    ORDER BY a.event_time ASC
  `;
  const res = await query(sql, [paymentId]);
  return res.rows;
};
