
import { query } from '../../db';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import { PoolClient } from 'pg';

export const createVehicle = async (data: any, userId: string) => {
  const sql = `
    INSERT INTO own_fleet_vehicles (vehicle_number, maintenance_notes)
    VALUES ($1, $2) RETURNING *
  `;
  const res = await query(sql, [data.vehicle_number, data.maintenance_notes || null]);
  const v = res.rows[0];

  await createAudit({ entityType: 'OWN_FLEET_VEHICLE', entityId: v.id, action: 'CREATE', newState: v, userId });
  return v;
};

export const getVehicles = async () => {
  // Derivation of AVAILABLE or IN_TRIP is handled at database view level or logic level.
  // We can join with trips to determine if it has an active trip.
  const res = await query(`
    SELECT o.*, 
    CASE 
      WHEN o.manual_state = 'SOLD_REMOVED' THEN 'SOLD_REMOVED'
      WHEN EXISTS (SELECT 1 FROM trips t WHERE t.own_fleet_vehicle_id = o.id AND t.status NOT IN ('COMPLETED', 'SETTLED', 'CANCELLED')) THEN 'IN_TRIP'
      WHEN o.manual_state = 'UNDER_MAINTENANCE' THEN 'UNDER_MAINTENANCE'
      ELSE 'AVAILABLE'
    END as status
    FROM own_fleet_vehicles o
    ORDER BY o.created_at DESC
  `);
  return res.rows;
};

export const getVehicleById = async (id: string) => {
  const res = await query(`
    SELECT o.*, 
    CASE 
      WHEN o.manual_state = 'SOLD_REMOVED' THEN 'SOLD_REMOVED'
      WHEN EXISTS (SELECT 1 FROM trips t WHERE t.own_fleet_vehicle_id = o.id AND t.status NOT IN ('COMPLETED', 'SETTLED', 'CANCELLED')) THEN 'IN_TRIP'
      WHEN o.manual_state = 'UNDER_MAINTENANCE' THEN 'UNDER_MAINTENANCE'
      ELSE 'AVAILABLE'
    END as status
    FROM own_fleet_vehicles o WHERE o.id = $1`, [id]);
  if (res.rows.length === 0) throw new AppError('NOT_FOUND', 'Own Fleet Vehicle not found', 404);
  return res.rows[0];
};

export const updateVehicle = async (id: string, data: any, userId: string) => {
  const existing = await getVehicleById(id);
  const fields = Object.keys(data).filter(k => data[k] !== undefined);
  if (fields.length === 0) return existing;

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => data[f]);
  const sql = `UPDATE own_fleet_vehicles SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await query(sql, [id, ...values]);
  const updated = res.rows[0];

  await createAudit({ entityType: 'OWN_FLEET_VEHICLE', entityId: id, action: 'UPDATE', previousState: existing, newState: updated, userId });
  return updated;
};

export const setMaintenance = async (id: string, isMaintenance: boolean, userId: string, notes?: string) => {
  const v = await getVehicleById(id);
  if (v.status === 'IN_TRIP' && isMaintenance) {
    throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot mark under maintenance while in active trip.', 422);
  }
  const nextState = isMaintenance ? 'UNDER_MAINTENANCE' : null;
  const res = await query(`UPDATE own_fleet_vehicles SET manual_state = $2, maintenance_notes = $3, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, nextState, notes || null]);
  await createAudit({ entityType: 'OWN_FLEET_VEHICLE', entityId: id, action: 'MAINTENANCE_CHANGE', newState: res.rows[0], userId });
  return res.rows[0];
};

export const setSold = async (id: string, soldData: any, userId: string) => {
  const res = await query(`UPDATE own_fleet_vehicles SET manual_state = 'SOLD_REMOVED', maintenance_notes = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, soldData.reason || null]);
  await createAudit({ entityType: 'OWN_FLEET_VEHICLE', entityId: id, action: 'SOLD_REMOVED', newState: res.rows[0], userId });
  return res.rows[0];
};

export const getVehicleTrips = async (id: string) => {
  const res = await query(`
    SELECT * FROM trips WHERE own_fleet_vehicle_id = $1 ORDER BY created_at DESC
  `, [id]);
  return res.rows;
};

export const getVehicleExpenses = async (id: string) => {
  const expensesQuery = `
    SELECT e.*, t.trip_number
    FROM own_fleet_expense_details e
    JOIN trips t ON t.id = e.trip_id
    WHERE t.own_fleet_vehicle_id = $1
    ORDER BY e.created_at DESC
  `;
  const paymentsQuery = `
    SELECT pa.*, p.payment_date, p.payment_mode, p.amount as total_payment_amount, t.trip_number
    FROM payment_allocations pa
    JOIN payments p ON p.id = pa.payment_id
    JOIN trips t ON t.id = pa.trip_id
    WHERE t.own_fleet_vehicle_id = $1 AND pa.category = 'OWN_FLEET_EXPENSE'
    ORDER BY p.payment_date DESC
  `;
  
  const expensesRes = await query(expensesQuery, [id]);
  const paymentsRes = await query(paymentsQuery, [id]);
  
  return {
    expenses: expensesRes.rows,
    paymentAllocations: paymentsRes.rows
  };
};
