
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
  const res = await query('SELECT id, party_type, name, primary_mobile, city, state, is_active FROM parties ORDER BY created_at DESC');
  return res.rows;
};

export const getPartyById = async (id: string) => {
  const res = await query('SELECT * FROM parties WHERE id = $1', [id]);
  if (res.rows.length === 0) throw new AppError('NOT_FOUND', 'Party not found', 404);
  return res.rows[0];
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
