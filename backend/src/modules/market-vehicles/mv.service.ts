
import { query } from '../../db';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';

export const createVehicle = async (data: any, userId: string) => {
  const sql = `
    INSERT INTO market_vehicles (vehicle_number, vehicle_owner_id, vehicle_type)
    VALUES ($1, $2, $3) RETURNING *
  `;
  const res = await query(sql, [data.vehicle_number, data.vehicle_owner_id, data.vehicle_type]);
  const v = res.rows[0];

  await createAudit({ entityType: 'MARKET_VEHICLE', entityId: v.id, action: 'CREATE', newState: v, userId });
  return v;
};

export const getVehicles = async () => {
  const res = await query(`
    SELECT m.id, m.vehicle_number, m.vehicle_type, m.vehicle_owner_id, o.name as owner_name 
    FROM market_vehicles m
    JOIN vehicle_owners o ON m.vehicle_owner_id = o.id
    ORDER BY m.created_at DESC
  `);
  return res.rows;
};

export const getVehicleById = async (id: string) => {
  const res = await query('SELECT * FROM market_vehicles WHERE id = $1', [id]);
  if (res.rows.length === 0) throw new AppError('NOT_FOUND', 'Market Vehicle not found', 404);
  return res.rows[0];
};

export const updateVehicle = async (id: string, data: any, userId: string) => {
  const existing = await getVehicleById(id);
  const fields = Object.keys(data).filter(k => data[k] !== undefined);
  if (fields.length === 0) return existing;

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => data[f]);
  const sql = `UPDATE market_vehicles SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const res = await query(sql, [id, ...values]);
  const updated = res.rows[0];

  await createAudit({ entityType: 'MARKET_VEHICLE', entityId: id, action: 'UPDATE', previousState: existing, newState: updated, userId });
  return updated;
};
