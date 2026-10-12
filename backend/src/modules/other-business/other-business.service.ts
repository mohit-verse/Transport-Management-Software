import { query } from '../../db';

export const getOtherBusinessCategories = async (type?: string) => {
  let sql = 'SELECT id, category_name, category_type, is_active, created_at, updated_at FROM other_business_categories WHERE is_active = true';
  const params: any[] = [];
  if (type) {
    sql += ' AND category_type = $1';
    params.push(type);
  }
  sql += ' ORDER BY category_name ASC';
  const res = await query(sql, params);
  return res.rows;
};
