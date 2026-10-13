import { Pool, PoolClient } from 'pg';
import { pool } from '../../db';
import { CANONICAL_DYNAMIC_FIELDS } from './dynamic-fields.definitions';

export async function seedDynamicFields(dbClient?: Pool | PoolClient): Promise<number> {
  const client = dbClient || pool;
  let seededCount = 0;

  for (const field of CANONICAL_DYNAMIC_FIELDS) {
    const res = await client.query(
      `INSERT INTO dynamic_field_definitions (source_entity, field_key, field_label, data_type, is_repeatable, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (source_entity, field_key) DO UPDATE
       SET field_label = EXCLUDED.field_label,
           data_type = EXCLUDED.data_type,
           is_repeatable = EXCLUDED.is_repeatable,
           is_active = true,
           updated_at = now()
       RETURNING id`,
      [field.source_entity, field.field_key, field.field_label, field.data_type, field.is_repeatable]
    );
    if (res.rowCount && res.rowCount > 0) {
      seededCount++;
    }
  }

  return seededCount;
}
