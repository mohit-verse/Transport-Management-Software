
import { query } from '../../db';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import { PoolClient } from 'pg';

export const createParty = async (data: any, userId: string, client?: PoolClient) => {
  const sql = `
    INSERT INTO parties 
    (party_type, name, primary_mobile, address, city, state, pin_code, gstin, pan_number, is_tds_applicable)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;
  const params = [
    data.party_type, data.name, data.primary_mobile, data.address, data.city, 
    data.state, data.pin_code, data.gstin, data.pan_number, data.is_tds_applicable
  ];
  
  const q = client ? client.query.bind(client) : query;
  const res = await q(sql, params);
  const newParty = res.rows[0];

  await createAudit({
    entityType: 'PARTY',
    entityId: newParty.id,
    action: 'CREATE',
    newState: newParty,
    userId
  }, client);

  return newParty;
};

export const getParties = async () => {
  // Excluding billing_configuration from list as it might be sensitive
  const sql = `
    SELECT 
      pr.id, pr.party_type, pr.name, pr.primary_mobile, pr.city, pr.state, pr.is_active,
      (
          SELECT COALESCE(SUM(b.balance_amount), 0)
          FROM bills b 
          WHERE b.party_id = pr.id AND b.bill_status != 'CANCELLED'
      ) + (
          SELECT COALESCE(SUM(pf.receivable_amount), 0)
          FROM trips t
          JOIN trip_party_financials pf ON pf.trip_id = t.id
          WHERE t.party_id = pr.id AND t.status != 'CANCELLED'
            AND NOT EXISTS (
                SELECT 1 FROM bill_items bi 
                JOIN bills b ON bi.bill_id = b.id
                WHERE bi.trip_id = t.id AND b.bill_status != 'CANCELLED'
            )
      ) - (
          SELECT COALESCE(SUM(pa.allocation_amount), 0)
          FROM payment_allocations pa
          JOIN trips t ON pa.trip_id = t.id
          LEFT JOIN payments p ON pa.payment_id = p.id
          WHERE t.party_id = pr.id AND t.status != 'CANCELLED'
            AND pa.allocation_type = 'TRIP'
            AND pa.allocation_status = 'ACTIVE'
            AND (p.payment_status = 'ACTIVE' OR p.id IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM bill_items bi 
                JOIN bills b ON bi.bill_id = b.id
                WHERE bi.trip_id = t.id AND b.bill_status != 'CANCELLED'
            )
      ) AS current_outstanding,
      (
          SELECT COALESCE(SUM(pa.allocation_amount), 0)
          FROM payment_allocations pa
          JOIN payments p ON p.id = pa.payment_id
          WHERE pa.allocation_type = 'CREDIT_GENERATED' 
            AND pa.allocation_status = 'ACTIVE' 
            AND p.payment_status = 'ACTIVE'
            AND p.party_id = pr.id
      ) - (
          SELECT COALESCE(SUM(pa.allocation_amount), 0)
          FROM payment_allocations pa
          JOIN payment_allocations source ON source.id = pa.party_credit_source_id
          JOIN payments p ON p.id = source.payment_id
          WHERE pa.allocation_type = 'CREDIT_UTILIZED' 
            AND pa.allocation_status = 'ACTIVE' 
            AND source.allocation_status = 'ACTIVE'
            AND p.payment_status = 'ACTIVE'
            AND p.party_id = pr.id
      ) AS current_credit
    FROM parties pr
    ORDER BY pr.created_at DESC
  `;
  const res = await query(sql);
  return res.rows.map(row => ({
    ...row,
    current_outstanding: parseFloat(row.current_outstanding || '0'),
    current_credit: parseFloat(row.current_credit || '0')
  }));
};

export const getPartyById = async (id: string) => {
  const res = await query('SELECT * FROM parties WHERE id = $1', [id]);
  if (res.rows.length === 0) throw new AppError('NOT_FOUND', 'Party not found', 404);
  return res.rows[0];
};

export const getPartyFinancials = async (id: string) => {
  // Financial position
  const finSql = `
    SELECT 
      (
        SELECT COALESCE(SUM(b.total_amount), 0)
        FROM bills b 
        WHERE b.party_id = $1 AND b.bill_status != 'CANCELLED'
      ) + (
        SELECT COALESCE(SUM(pf.receivable_amount), 0)
        FROM trips t
        JOIN trip_party_financials pf ON pf.trip_id = t.id
        WHERE t.party_id = $1 AND t.status != 'CANCELLED'
          AND NOT EXISTS (
              SELECT 1 FROM bill_items bi 
              JOIN bills b ON bi.bill_id = b.id
              WHERE bi.trip_id = t.id AND b.bill_status != 'CANCELLED'
          )
      ) AS total_receivable,
      
      (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM payments p
        WHERE p.party_id = $1 AND p.payment_status = 'ACTIVE' AND p.payment_type = 'INCOMING'
      ) AS amount_received,
      
      (
        SELECT COALESCE(SUM(pf.tds_amount), 0)
        FROM trips t
        JOIN trip_party_financials pf ON pf.trip_id = t.id
        WHERE t.party_id = $1 AND t.status != 'CANCELLED'
      ) AS tds_amount,
      
      (
        SELECT COALESCE(SUM(td.amount), 0)
        FROM trips t
        JOIN trip_deductions td ON td.trip_id = t.id
        WHERE t.party_id = $1 AND t.status != 'CANCELLED' AND td.side = 'PARTY'
      ) AS deductions
  `;
  const finRes = await query(finSql, [id]);
  const fin = finRes.rows[0];
  
  const outSql = `
    SELECT 
      (
          SELECT COALESCE(SUM(b.balance_amount), 0)
          FROM bills b 
          WHERE b.party_id = $1 AND b.bill_status != 'CANCELLED'
      ) + (
          SELECT COALESCE(SUM(pf.receivable_amount), 0)
          FROM trips t
          JOIN trip_party_financials pf ON pf.trip_id = t.id
          WHERE t.party_id = $1 AND t.status != 'CANCELLED'
            AND NOT EXISTS (
                SELECT 1 FROM bill_items bi 
                JOIN bills b ON bi.bill_id = b.id
                WHERE bi.trip_id = t.id AND b.bill_status != 'CANCELLED'
            )
      ) - (
          SELECT COALESCE(SUM(pa.allocation_amount), 0)
          FROM payment_allocations pa
          JOIN trips t ON pa.trip_id = t.id
          LEFT JOIN payments p ON pa.payment_id = p.id
          WHERE t.party_id = $1 AND t.status != 'CANCELLED'
            AND pa.allocation_type = 'TRIP'
            AND pa.allocation_status = 'ACTIVE'
            AND (p.payment_status = 'ACTIVE' OR p.id IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM bill_items bi 
                JOIN bills b ON bi.bill_id = b.id
                WHERE bi.trip_id = t.id AND b.bill_status != 'CANCELLED'
            )
      ) AS current_outstanding
  `;
  const outRes = await query(outSql, [id]);
  
  const credSql = `
    SELECT 
      (
          SELECT COALESCE(SUM(pa.allocation_amount), 0)
          FROM payment_allocations pa
          JOIN payments p ON p.id = pa.payment_id
          WHERE pa.allocation_type = 'CREDIT_GENERATED' 
            AND pa.allocation_status = 'ACTIVE' 
            AND p.payment_status = 'ACTIVE'
            AND p.party_id = $1
      ) AS credit_generated,
      (
          SELECT COALESCE(SUM(pa.allocation_amount), 0)
          FROM payment_allocations pa
          JOIN payment_allocations source ON source.id = pa.party_credit_source_id
          JOIN payments p ON p.id = source.payment_id
          WHERE pa.allocation_type = 'CREDIT_UTILIZED' 
            AND pa.allocation_status = 'ACTIVE' 
            AND source.allocation_status = 'ACTIVE'
            AND p.payment_status = 'ACTIVE'
            AND p.party_id = $1
      ) AS credit_utilized
  `;
  const credRes = await query(credSql, [id]);
  const cred = credRes.rows[0];
  const creditGen = parseFloat(cred.credit_generated || '0');
  const creditUtil = parseFloat(cred.credit_utilized || '0');

  return {
    financialPosition: {
      totalReceivable: parseFloat(fin.total_receivable || '0'),
      amountReceived: parseFloat(fin.amount_received || '0'),
      tds: parseFloat(fin.tds_amount || '0'),
      deductions: parseFloat(fin.deductions || '0'),
      outstanding: parseFloat(outRes.rows[0].current_outstanding || '0')
    },
    creditPosition: {
      creditGenerated: creditGen,
      creditUtilized: creditUtil,
      creditRemaining: creditGen - creditUtil,
      currentCredit: creditGen - creditUtil
    },
    tdsInformation: {
      totalTdsDeducted: parseFloat(fin.tds_amount || '0')
    }
  };
};

export const getPartyTrips = async (id: string, limit = 10) => {
  const res = await query('SELECT * FROM trips WHERE party_id = $1 ORDER BY trip_date DESC, created_at DESC LIMIT $2', [id, limit]);
  return res.rows;
};

export const getPartyBills = async (id: string, limit = 10) => {
  const res = await query('SELECT * FROM bills WHERE party_id = $1 ORDER BY bill_date DESC, created_at DESC LIMIT $2', [id, limit]);
  return res.rows;
};

export const getPartyPayments = async (id: string, limit = 10) => {
  const res = await query('SELECT * FROM payments WHERE party_id = $1 AND payment_type = \'INCOMING\' ORDER BY payment_date DESC, created_at DESC LIMIT $2', [id, limit]);
  return res.rows;
};

export const updateParty = async (id: string, data: any, userId: string) => {
  const existing = await getPartyById(id);
  
  const fields = Object.keys(data).filter(k => data[k] !== undefined);
  if (fields.length === 0) return existing;

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => data[f]);
  
  const sql = `UPDATE parties SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await query(sql, [id, ...values]);
  const updated = res.rows[0];

  await createAudit({
    entityType: 'PARTY',
    entityId: id,
    action: 'UPDATE',
    previousState: existing,
    newState: updated,
    userId
  });

  return updated;
};

export const updateBillingConfig = async (id: string, config: any, userId: string) => {
  const existing = await getPartyById(id);
  const sql = `UPDATE parties SET billing_configuration = $2, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await query(sql, [id, config]);
  const updated = res.rows[0];

  await createAudit({
    entityType: 'PARTY',
    entityId: id,
    action: 'UPDATE_BILLING_CONFIG',
    previousState: existing,
    newState: updated,
    userId
  });

  return updated;
};
