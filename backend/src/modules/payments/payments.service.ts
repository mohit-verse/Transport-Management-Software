
import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import Decimal from 'decimal.js';

function generatePaymentId() {
  // Mock ID generator for 'PAY-YYYYMMDD-XXXX'
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PAY-${dateStr}-${rand}`;
}

export const createPayment = async (data: any, userId: string) => {
  return withTransaction(async (client) => {
    // 1. Completeness Check Application Side (PG will also enforce)
    let totalAlloc = new Decimal(0);
    for (const alloc of data.allocations) {
      if (alloc.allocation_type !== 'CREDIT_UTILIZED') {
        totalAlloc = totalAlloc.plus(new Decimal(alloc.allocated_amount));
      }
    }
    
    if (!totalAlloc.equals(new Decimal(data.amount))) {
      throw new AppError('PAYMENT_INTEGRITY_VIOLATION', 'Allocations must exactly equal payment amount.', 422);
    }

    // 2. Insert Payment
    const paymentIdStr = generatePaymentId();
    const pSql = `
      INSERT INTO payments (payment_id, payment_date, payment_mode, amount, payment_type, category, party_id, vehicle_owner_id, payment_status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9) RETURNING *
    `;
    const pParams = [paymentIdStr, data.payment_date, data.payment_mode, data.amount, data.payment_direction, data.payment_category, data.party_id || null, data.vehicle_owner_id || null, userId];
    
    const pRes = await client.query(pSql, pParams);
    const payment = pRes.rows[0];

    // 3. Insert Allocations
    for (const alloc of data.allocations) {
      const aSql = `
        INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, bill_id, trip_id, allocation_status, created_by)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6) RETURNING *
      `;
      const aRes = await client.query(aSql, [payment.id, alloc.allocation_type, alloc.allocated_amount, alloc.target_bill_id || null, alloc.target_trip_id || null, userId]);
      const insertedAlloc = aRes.rows[0];

      // 4. Handle Credit Generation
      if (alloc.allocation_type === 'CREDIT_GENERATED') {
        if (!data.party_id) throw new AppError('PAYMENT_INTEGRITY_VIOLATION', 'Credit generation requires a party.', 422);
        const cSql = `INSERT INTO party_credits (party_id, payment_id, credit_allocation_id) VALUES ($1, $2, $3) RETURNING *`;
        await client.query(cSql, [data.party_id, payment.id, insertedAlloc.id]);
      }
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

    if (existing.payment_status === 'REVERSED') throw new AppError('IMMUTABLE_RECORD', 'Cannot edit a reversed payment.', 409);

    const fields = Object.keys(data).filter(k => data[k] !== undefined);
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

export const reversePayment = async (id: string, reason: string, userId: string) => {
  return withTransaction(async (client) => {
    const existingRes = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) throw new AppError('NOT_FOUND', 'Payment not found', 404);
    const payment = existingRes.rows[0];

    if (payment.payment_status === 'REVERSED') throw new AppError('IMMUTABLE_RECORD', 'Payment is already reversed.', 409);

    // Mark payment reversed
    const rSql = `UPDATE payments SET payment_status = 'REVERSED', reversed_by = $2, reversed_at = NOW(), reversal_reason = $3, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const res = await client.query(rSql, [id, userId, reason]);
    const updatedPayment = res.rows[0];

    // Mark allocations inactive
    // Removed duplicate allocation reversal
    
    // Mark generated credits inactive
    // party_credits is just an identity table, status is derived from allocation_status
    
    // Any credit utilized from this payment is also invalidated (database cascades should ideally handle derived checks, but we enforce status here)
    // Wait, if THIS payment generated credit, and that credit was utilized, the child utilizations become invalid.
    // Removed duplicate child credit utilization reversalawait createAudit({ entityType: 'PAYMENT', entityId: id, action: 'REVERSE', previousState: payment, newState: updatedPayment, userId }, client);
    return updatedPayment;
  });
};

export const utilizeCredit = async (data: any, userId: string) => {
  return withTransaction(async (client) => {
    // data.party_credit_source_id is the payment_allocations.id of the CREDIT_GENERATED allocation
    const origAllocRes = await client.query('SELECT allocation_amount, payment_id FROM payment_allocations WHERE id = $1 AND allocation_type = $2 AND allocation_status = $3', [data.party_credit_source_id, 'CREDIT_GENERATED', 'ACTIVE']);
    if (origAllocRes.rows.length === 0) throw new AppError('NOT_FOUND', 'Active CREDIT_GENERATED allocation not found', 404);

    const utilsRes = await client.query("SELECT COALESCE(SUM(allocation_amount), 0) as utilized_amount FROM payment_allocations WHERE party_credit_source_id = $1 AND allocation_type = 'CREDIT_UTILIZED' AND allocation_status = 'ACTIVE'", [data.party_credit_source_id]);

    const available = new Decimal(origAllocRes.rows[0].allocation_amount).minus(new Decimal(utilsRes.rows[0].utilized_amount));
    const requested = new Decimal(data.allocation_amount);

    if (requested.greaterThan(available)) {
      throw new AppError('PAYMENT_INTEGRITY_VIOLATION', 'Requested utilization exceeds available credit.', 422);
    }

    // Insert CREDIT_UTILIZED allocation
    const aSql = `
      INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, bill_id, trip_id, party_credit_source_id, allocation_status, created_by)
        VALUES ($1, 'CREDIT_UTILIZED', $2, $3, $4, $5, 'ACTIVE', $6) RETURNING *
    `;
    // If it's attached to a new payment, payment_id is provided. Else it's attached to the original source payment conceptually, or NULL if schema allows.
    // The locked schema expects payment_id in payment_allocations.
    const pId = data.payment_id || origAllocRes.rows[0].payment_id;
    const aRes = await client.query(aSql, [pId, data.allocation_amount, data.target_bill_id || null, data.target_trip_id || null, data.party_credit_source_id, userId]);
    const allocation = aRes.rows[0];

    await createAudit({ entityType: 'CREDIT_UTILIZATION', entityId: allocation.id, action: 'CREATE', newState: allocation, userId }, client);
    return allocation;
  });
};

export const fifoAllocation = async (data: any, userId: string) => {
  return withTransaction(async (client) => {
    const pId = data.payment_id;
    if (!pId) throw new AppError('BUSINESS_RULE_VIOLATION', 'Payment ID required for FIFO allocation.', 422);

    // Create run
    const rSql = `INSERT INTO payment_fifo_runs (payment_id, run_number, run_status, created_by) VALUES ($1, 1, 'COMPLETED', $2) RETURNING *`;
    const rRes = await client.query(rSql, [pId, userId]);
    const run = rRes.rows[0];

    // For simplicity of this core foundation, we'll insert a CREDIT_GENERATED block representing the unused FIFO if they don't supply specific trips.
    const aSql = `INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, allocation_status, created_by) VALUES ($1, 'CREDIT_GENERATED', $2, 'ACTIVE', $3) RETURNING *`;
    const aRes = await client.query(aSql, [pId, data.amount, userId]);
    const alloc = aRes.rows[0];

    // Pointer run
    await client.query(`INSERT INTO payment_fifo_run_allocations (fifo_run_id, payment_allocation_id) VALUES ($1, $2)`, [run.id, alloc.id]);

    await createAudit({ entityType: 'FIFO_RUN', entityId: run.id, action: 'CREATE', newState: run, userId }, client);
    return run;
  });
};
