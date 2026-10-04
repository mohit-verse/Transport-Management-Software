import { PoolClient } from 'pg';
import { query } from '../db';

interface AuditEvent {
  entityType: string;
  entityId: string;
  action: string;
  previousState?: any;
  newState?: any;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export const createAudit = async (event: AuditEvent, client?: PoolClient) => {
  const sql = `
    INSERT INTO audit_events 
    (actor_user_id, action_type, module_name, entity_type, entity_id, before_state, after_state, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  const moduleName = event.entityType.toUpperCase();
  const params = [
    event.userId,
    event.action,
    moduleName,
    event.entityType,
    event.entityId,
    event.previousState || null,
    event.newState || null,
    event.ipAddress || null,
  ];

  if (client) {
    await client.query(sql, params);
  } else {
    await query(sql, params);
  }
};
