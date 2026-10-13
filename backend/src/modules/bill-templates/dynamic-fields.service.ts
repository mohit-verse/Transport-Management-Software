import { query } from '../../db';

export interface DynamicFieldFilter {
  source_entity?: string;
  search?: string;
  is_repeatable?: boolean;
}

export async function listDynamicFields(filters?: DynamicFieldFilter) {
  let sql = `
    SELECT id, source_entity, field_key, field_label, data_type, is_repeatable, is_active, created_at, updated_at
    FROM dynamic_field_definitions
    WHERE is_active = true
  `;
  const params: any[] = [];

  if (filters?.source_entity) {
    params.push(filters.source_entity);
    sql += ` AND source_entity = $${params.length}`;
  }

  if (filters?.search) {
    params.push(`%${filters.search}%`);
    sql += ` AND (field_key ILIKE $${params.length} OR field_label ILIKE $${params.length})`;
  }

  if (filters?.is_repeatable !== undefined) {
    params.push(filters.is_repeatable);
    sql += ` AND is_repeatable = $${params.length}`;
  }

  sql += ` ORDER BY source_entity ASC, field_key ASC`;

  const res = await query(sql, params);
  return res.rows;
}
