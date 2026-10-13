import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';

export interface ListSeriesFilters {
  party_id?: string;
  financial_year_id?: string;
  is_active?: boolean;
}

export async function listSeries(filters?: ListSeriesFilters) {
  let sql = `
    SELECT bns.id, bns.party_id, bns.financial_year_id, bns.series_code, bns.prefix, bns.current_number,
           bns.is_active, bns.created_by, bns.created_at, bns.updated_at,
           p.name as party_name,
           fy.code as financial_year_code,
           u.name as created_by_name
    FROM bill_numbering_series bns
    JOIN parties p ON p.id = bns.party_id
    JOIN financial_years fy ON fy.id = bns.financial_year_id
    LEFT JOIN users u ON u.id = bns.created_by
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters?.party_id) {
    params.push(filters.party_id);
    sql += ` AND bns.party_id = $${params.length}`;
  }

  if (filters?.financial_year_id) {
    params.push(filters.financial_year_id);
    sql += ` AND bns.financial_year_id = $${params.length}`;
  }

  if (filters?.is_active !== undefined) {
    params.push(filters.is_active);
    sql += ` AND bns.is_active = $${params.length}`;
  }

  sql += ` ORDER BY fy.start_date DESC, bns.created_at DESC`;

  const res = await query(sql, params);
  return res.rows;
}

export async function getSeriesById(id: string, client?: any) {
  const runner = client || { query };
  const res = await runner.query(
    `SELECT bns.*, p.name as party_name, fy.code as financial_year_code, u.name as created_by_name
     FROM bill_numbering_series bns
     JOIN parties p ON p.id = bns.party_id
     JOIN financial_years fy ON fy.id = bns.financial_year_id
     LEFT JOIN users u ON u.id = bns.created_by
     WHERE bns.id = $1`,
    [id]
  );
  if (res.rowCount === 0) {
    throw new AppError('NOT_FOUND', 'Numbering series not found', 404);
  }
  return res.rows[0];
}

export async function createSeries(data: any, userId: string) {
  return withTransaction(async (client) => {
    // Validate party exists
    const pCheck = await client.query('SELECT id, name FROM parties WHERE id = $1', [data.party_id]);
    if (pCheck.rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Party not found', 404);
    }

    // Validate FY exists
    const fyCheck = await client.query('SELECT id, code FROM financial_years WHERE id = $1', [data.financial_year_id]);
    if (fyCheck.rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Financial year not found', 404);
    }

    // Check unique constraint
    const uCheck = await client.query(
      'SELECT id FROM bill_numbering_series WHERE party_id = $1 AND financial_year_id = $2 AND series_code = $3',
      [data.party_id, data.financial_year_id, data.series_code]
    );
    if (uCheck.rowCount && uCheck.rowCount > 0) {
      throw new AppError('CONFLICT', `Series code "${data.series_code}" already exists for this party and financial year`, 409);
    }

    const res = await client.query(
      `INSERT INTO bill_numbering_series
       (party_id, financial_year_id, series_code, prefix, current_number, is_active, created_by)
       VALUES ($1, $2, $3, $4, 0, true, $5)
       RETURNING *`,
      [data.party_id, data.financial_year_id, data.series_code, data.prefix, userId]
    );
    const series = res.rows[0];

    await createAudit(
      {
        entityType: 'NUMBERING_SERIES',
        entityId: series.id,
        action: 'CREATE',
        newState: series,
        userId
      },
      client
    );

    return getSeriesById(series.id, client);
  });
}

export async function updateSeries(id: string, data: any, userId: string) {
  return withTransaction(async (client) => {
    const existing = await getSeriesById(id, client);

    // If prefix or series_code changed, verify whether bills have been generated
    if (
      (data.prefix && data.prefix !== existing.prefix) ||
      (data.series_code && data.series_code !== existing.series_code)
    ) {
      if (existing.current_number > 0) {
        throw new AppError(
          'BUSINESS_RULE_VIOLATION',
          'Cannot alter prefix or series code of a numbering series that has already generated bills',
          422
        );
      }
    }

    // If series_code changed, verify uniqueness
    if (data.series_code && data.series_code !== existing.series_code) {
      const uCheck = await client.query(
        'SELECT id FROM bill_numbering_series WHERE party_id = $1 AND financial_year_id = $2 AND series_code = $3 AND id != $4',
        [existing.party_id, existing.financial_year_id, data.series_code, id]
      );
      if (uCheck.rowCount && uCheck.rowCount > 0) {
        throw new AppError('CONFLICT', `Series code "${data.series_code}" already exists for this party and financial year`, 409);
      }
    }

    const series_code = data.series_code !== undefined ? data.series_code : existing.series_code;
    const prefix = data.prefix !== undefined ? data.prefix : existing.prefix;
    const is_active = data.is_active !== undefined ? data.is_active : existing.is_active;

    const res = await client.query(
      `UPDATE bill_numbering_series
       SET series_code = $1, prefix = $2, is_active = $3, updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [series_code, prefix, is_active, id]
    );
    const updated = res.rows[0];

    await createAudit(
      {
        entityType: 'NUMBERING_SERIES',
        entityId: id,
        action: 'UPDATE',
        previousState: existing,
        newState: updated,
        userId
      },
      client
    );

    return getSeriesById(id, client);
  });
}

export async function deactivateSeries(id: string, userId: string) {
  return updateSeries(id, { is_active: false }, userId);
}
