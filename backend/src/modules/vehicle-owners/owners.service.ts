
import { query } from '../../db';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import { PoolClient } from 'pg';

export const createOwner = async (data: any, userId: string, client?: PoolClient) => {
  const sql = `
    INSERT INTO vehicle_owners 
    (name, mobile_number, address, city, state, pan_number, bank_details)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const params = [
    data.name, data.mobile_number, data.address, data.city, 
    data.state, data.pan_number, data.bank_details
  ];
  
  const q = client ? client.query.bind(client) : query;
  const res = await q(sql, params);
  const newOwner = res.rows[0];

  await createAudit({
    entityType: 'VEHICLE_OWNER',
    entityId: newOwner.id,
    action: 'CREATE',
    newState: newOwner,
    userId
  }, client);

  return newOwner;
};

export const getOwners = async () => {
  const sql = `
    SELECT 
      vo.*,
      COALESCE(ARRAY_AGG(mv.vehicle_number) FILTER (WHERE mv.is_active = true AND mv.vehicle_number IS NOT NULL), '{}') AS owned_vehicle_numbers
    FROM vehicle_owners vo
    LEFT JOIN market_vehicles mv ON mv.vehicle_owner_id = vo.id
    GROUP BY vo.id
    ORDER BY vo.created_at DESC
  `;
  const res = await query(sql);
  return res.rows;
};

export const getOwnerById = async (id: string) => {
  const res = await query('SELECT * FROM vehicle_owners WHERE id = $1', [id]);
  if (res.rows.length === 0) throw new AppError('NOT_FOUND', 'Vehicle Owner not found', 404);
  return res.rows[0];
};

export const getOwnerFinancials = async (id: string) => {
  // Ensure owner exists
  await getOwnerById(id);

  const sql = `
    WITH payable AS (
      SELECT COALESCE(SUM(payable_amount), 0) as total_payable
      FROM trip_vehicle_owner_financials tvof
      JOIN trips t ON t.id = tvof.trip_id
      WHERE t.vehicle_owner_id = $1
    ),
    paid AS (
      SELECT COALESCE(SUM(allocation_amount), 0) as total_paid
      FROM payment_allocations pa
      JOIN payments p ON p.id = pa.payment_id
      WHERE (pa.vehicle_owner_id = $1 OR 
             (pa.allocation_type = 'TRIP' AND pa.trip_id IN (SELECT id FROM trips WHERE vehicle_owner_id = $1)))
        AND pa.allocation_status = 'ACTIVE'
        AND p.payment_status = 'ACTIVE'
        AND p.payment_type = 'OUTGOING'
    )
    SELECT 
      payable.total_payable AS "totalPayable",
      paid.total_paid AS "amountPaid",
      (payable.total_payable - paid.total_paid) AS "outstanding"
    FROM payable, paid;
  `;
  const res = await query(sql, [id]);
  return {
    totalPayable: parseFloat(res.rows[0].totalPayable),
    amountPaid: parseFloat(res.rows[0].amountPaid),
    outstanding: parseFloat(res.rows[0].outstanding)
  };
};

export const getOwnerVehicles = async (id: string) => {
  const sql = `SELECT * FROM market_vehicles WHERE vehicle_owner_id = $1 AND is_active = true ORDER BY created_at DESC`;
  const res = await query(sql, [id]);
  return res.rows;
};

export const getOwnerTrips = async (id: string) => {
  const sql = `
    SELECT t.*, tvof.freight_amount, tvof.detention_amount, tvof.payable_amount 
    FROM trips t
    LEFT JOIN trip_vehicle_owner_financials tvof ON tvof.trip_id = t.id
    WHERE t.vehicle_owner_id = $1
    ORDER BY t.created_at DESC
  `;
  const res = await query(sql, [id]);
  return res.rows;
};

export const getOwnerPayments = async (id: string) => {
  const sql = `
    SELECT p.*, 
      (SELECT json_agg(json_build_object('id', pa.id, 'type', pa.allocation_type, 'amount', pa.allocation_amount, 'status', pa.allocation_status))
       FROM payment_allocations pa WHERE pa.payment_id = p.id) as allocations
    FROM payments p
    WHERE p.vehicle_owner_id = $1 AND p.payment_status = 'ACTIVE'
    ORDER BY p.payment_date DESC, p.created_at DESC
  `;
  const res = await query(sql, [id]);
  return res.rows;
};

export const updateOwner = async (id: string, data: any, userId: string) => {
  const existing = await getOwnerById(id);
  
  const fields = Object.keys(data).filter(k => data[k] !== undefined);
  if (fields.length === 0) return existing;

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => data[f]);
  
  const sql = `UPDATE vehicle_owners SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await query(sql, [id, ...values]);
  const updated = res.rows[0];

  await createAudit({
    entityType: 'VEHICLE_OWNER',
    entityId: id,
    action: 'UPDATE',
    previousState: existing,
    newState: updated,
    userId
  });

  return updated;
};
