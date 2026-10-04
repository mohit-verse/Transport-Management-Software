
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
  const res = await query('SELECT id, name, mobile_number, city, state, is_active FROM vehicle_owners ORDER BY created_at DESC');
  return res.rows;
};

export const getOwnerById = async (id: string) => {
  const res = await query('SELECT * FROM vehicle_owners WHERE id = $1', [id]);
  if (res.rows.length === 0) throw new AppError('NOT_FOUND', 'Vehicle Owner not found', 404);
  return res.rows[0];
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
