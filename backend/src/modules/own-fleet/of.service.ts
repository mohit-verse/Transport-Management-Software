
import { query } from '../../db';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import { PoolClient } from 'pg';

export const createVehicle = async (data: any, userId: string) => {
  const sql = `
    INSERT INTO own_fleet_vehicles (vehicle_number, vehicle_type, capacity_tonnage, purchase_date)
    VALUES ($1, $2, $3, $4) RETURNING *
  `;
  const res = await query(sql, [data.vehicle_number, data.vehicle_type, data.capacity_tonnage, data.purchase_date]);
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
      WHEN o.is_sold_removed THEN 'SOLD_REMOVED'
      WHEN EXISTS (SELECT 1 FROM trips t WHERE t.own_fleet_vehicle_id = o.id AND t.trip_status NOT IN ('COMPLETED', 'SETTLED', 'CANCELLED')) THEN 'IN_TRIP'
      WHEN o.is_under_maintenance THEN 'UNDER_MAINTENANCE'
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
      WHEN o.is_sold_removed THEN 'SOLD_REMOVED'
      WHEN EXISTS (SELECT 1 FROM trips t WHERE t.own_fleet_vehicle_id = o.id AND t.trip_status NOT IN ('COMPLETED', 'SETTLED', 'CANCELLED')) THEN 'IN_TRIP'
      WHEN o.is_under_maintenance THEN 'UNDER_MAINTENANCE'
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

export const setMaintenance = async (id: string, isMaintenance: boolean, userId: string) => {
  const v = await getVehicleById(id);
  if (v.status === 'IN_TRIP' && isMaintenance) {
    throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot mark under maintenance while in active trip.', 422);
  }
  const res = await query(`UPDATE own_fleet_vehicles SET is_under_maintenance = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, isMaintenance]);
  await createAudit({ entityType: 'OWN_FLEET_VEHICLE', entityId: id, action: 'MAINTENANCE_CHANGE', newState: res.rows[0], userId });
  return res.rows[0];
};

export const setSold = async (id: string, soldData: any, userId: string) => {
  const res = await query(`UPDATE own_fleet_vehicles SET is_sold_removed = true, sold_removed_reason = $2, sold_removed_date = $3, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, soldData.reason, soldData.date]);
  await createAudit({ entityType: 'OWN_FLEET_VEHICLE', entityId: id, action: 'SOLD_REMOVED', newState: res.rows[0], userId });
  return res.rows[0];
};
