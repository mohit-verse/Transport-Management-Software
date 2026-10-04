import { pool } from '../../db';

const buildWhereClause = (query: any, prefix: string = '') => {
  const conditions = [];
  const values = [];
  let paramIdx = 1;

  if (query.fromDate) {
    conditions.push(`${prefix}payment_date >= $${paramIdx++}`);
    values.push(query.fromDate);
  }
  if (query.toDate) {
    conditions.push(`${prefix}payment_date <= $${paramIdx++}`);
    values.push(query.toDate);
  }
  if (query.partyId) {
    conditions.push(`${prefix}party_id = $${paramIdx++}`);
    values.push(query.partyId);
  }
  if (query.vehicleOwnerId) {
    conditions.push(`${prefix}vehicle_owner_id = $${paramIdx++}`);
    values.push(query.vehicleOwnerId);
  }
  // Financial year might need custom join depending on date, but for now we filter by date range if fy provided,
  // or if payment table has financial year? The payment table doesn't have financial_year_id, it has payment_date.
  // Assuming frontend passes fromDate/toDate for financial year, or we look it up.
  return {
    where: conditions.length ? `AND ${conditions.join(' AND ')}` : '',
    values,
    nextParamIdx: paramIdx
  };
};

export const getFinancialSummary = async (query: any) => {
  const { where, values } = buildWhereClause(query, '');
  
  const incomingResult = await pool.query(`
    SELECT SUM(amount) as total_incoming
    FROM payments
    WHERE payment_type = 'INCOMING' AND payment_status = 'ACTIVE' ${where}
  `, values);

  const outgoingResult = await pool.query(`
    SELECT SUM(amount) as total_outgoing
    FROM payments
    WHERE payment_type = 'OUTGOING' AND payment_status = 'ACTIVE' ${where}
  `, values);

  const totalIncoming = parseFloat(incomingResult.rows[0].total_incoming || '0');
  const totalOutgoing = parseFloat(outgoingResult.rows[0].total_outgoing || '0');
  const netPnl = totalIncoming - totalOutgoing;

  return {
    totalIncoming,
    totalOutgoing,
    netPnl
  };
};

export const getPnl = async (query: any) => {
  const { where, values } = buildWhereClause(query, '');

  const incomingByCategory = await pool.query(`
    SELECT category, SUM(amount) as total
    FROM payments
    WHERE payment_type = 'INCOMING' AND payment_status = 'ACTIVE' ${where}
    GROUP BY category
  `, values);

  const outgoingByCategory = await pool.query(`
    SELECT category, SUM(amount) as total
    FROM payments
    WHERE payment_type = 'OUTGOING' AND payment_status = 'ACTIVE' ${where}
    GROUP BY category
  `, values);

  const summary = await getFinancialSummary(query);

  return {
    ...summary,
    incomingByCategory: incomingByCategory.rows,
    outgoingByCategory: outgoingByCategory.rows
  };
};

export const getIncoming = async (query: any) => {
  const { where, values, nextParamIdx } = buildWhereClause(query, 'p.');
  
  let pagination = '';
  const limit = query.pageSize ? parseInt(query.pageSize, 10) : 50;
  const page = query.page ? parseInt(query.page, 10) : 1;
  const offset = (page - 1) * limit;

  pagination = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
  
  const queryStr = `
    SELECT p.*,
           pr.name as party_name,
           obc.category_name as other_category_name
    FROM payments p
    LEFT JOIN parties pr ON p.party_id = pr.id
    LEFT JOIN other_business_categories obc ON p.other_business_category_id = obc.id
    WHERE p.payment_type = 'INCOMING' AND p.payment_status = 'ACTIVE' ${where}
    ORDER BY p.payment_date DESC, p.created_at DESC
    ${pagination}
  `;
  
  const countStr = `
    SELECT COUNT(*) as count, SUM(p.amount) as total
    FROM payments p
    WHERE p.payment_type = 'INCOMING' AND p.payment_status = 'ACTIVE' ${where}
  `;

  const items = await pool.query(queryStr, [...values, limit, offset]);
  const meta = await pool.query(countStr, values);

  return {
    items: items.rows,
    total: parseFloat(meta.rows[0].total || '0'),
    count: parseInt(meta.rows[0].count, 10)
  };
};

export const getOutgoing = async (query: any) => {
  const { where, values, nextParamIdx } = buildWhereClause(query, 'p.');
  
  let pagination = '';
  const limit = query.pageSize ? parseInt(query.pageSize, 10) : 50;
  const page = query.page ? parseInt(query.page, 10) : 1;
  const offset = (page - 1) * limit;

  pagination = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;

  const queryStr = `
    SELECT p.*,
           vo.name as vehicle_owner_name,
           obc.category_name as other_category_name
    FROM payments p
    LEFT JOIN vehicle_owners vo ON p.vehicle_owner_id = vo.id
    LEFT JOIN other_business_categories obc ON p.other_business_category_id = obc.id
    WHERE p.payment_type = 'OUTGOING' AND p.payment_status = 'ACTIVE' ${where}
    ORDER BY p.payment_date DESC, p.created_at DESC
    ${pagination}
  `;

  const countStr = `
    SELECT COUNT(*) as count, SUM(p.amount) as total
    FROM payments p
    WHERE p.payment_type = 'OUTGOING' AND p.payment_status = 'ACTIVE' ${where}
  `;

  const items = await pool.query(queryStr, [...values, limit, offset]);
  const meta = await pool.query(countStr, values);

  return {
    items: items.rows,
    total: parseFloat(meta.rows[0].total || '0'),
    count: parseInt(meta.rows[0].count, 10)
  };
};

export const getPaymentModes = async (query: any) => {
  const { where, values } = buildWhereClause(query, '');

  const result = await pool.query(`
    SELECT payment_mode, 
           SUM(CASE WHEN payment_type = 'INCOMING' THEN amount ELSE 0 END) as incoming_amount,
           SUM(CASE WHEN payment_type = 'OUTGOING' THEN amount ELSE 0 END) as outgoing_amount,
           COUNT(*) as payment_count
    FROM payments
    WHERE payment_status = 'ACTIVE' ${where}
    GROUP BY payment_mode
  `, values);

  return result.rows;
};

export const getCredits = async (query: any) => {
  let paramIdx = 1;
  const values: any[] = [];
  let partyCondition = '';
  
  if (query.partyId) {
    partyCondition = `AND p.party_id = $${paramIdx++}`;
    values.push(query.partyId);
  }

  const generated = await pool.query(`
    SELECT SUM(pa.allocation_amount) as total_generated
    FROM payment_allocations pa
    JOIN payments p ON p.id = pa.payment_id
    WHERE pa.allocation_type = 'CREDIT_GENERATED' 
      AND pa.allocation_status = 'ACTIVE' 
      AND p.payment_status = 'ACTIVE'
      ${partyCondition}
  `, values);

  const utilized = await pool.query(`
    SELECT SUM(pa.allocation_amount) as total_utilized
    FROM payment_allocations pa
    JOIN payment_allocations source ON source.id = pa.party_credit_source_id
    JOIN payments p ON p.id = source.payment_id
    WHERE pa.allocation_type = 'CREDIT_UTILIZED' 
      AND pa.allocation_status = 'ACTIVE' 
      AND source.allocation_status = 'ACTIVE'
      AND p.payment_status = 'ACTIVE'
      ${partyCondition}
  `, values);

  const gen = parseFloat(generated.rows[0].total_generated || '0');
  const util = parseFloat(utilized.rows[0].total_utilized || '0');

  return {
    creditGenerated: gen,
    creditUtilized: util,
    remainingCredit: gen - util
  };
};

export const getTds = async (query: any) => {
  const limit = query.pageSize ? parseInt(query.pageSize, 10) : 50;
  const page = query.page ? parseInt(query.page, 10) : 1;
  const offset = (page - 1) * limit;

  const result = await pool.query(`
    SELECT t.trip_number, t.trip_date, p.name as party_name, tf.tds_amount
    FROM trips t
    JOIN trip_party_financials tf ON t.id = tf.trip_id
    JOIN parties p ON t.party_id = p.id
    WHERE tf.tds_amount > 0 AND t.status != 'CANCELLED'
    ORDER BY t.trip_date DESC, t.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
  
  const countRes = await pool.query(`
    SELECT COUNT(*) as count, SUM(tf.tds_amount) as total
    FROM trips t
    JOIN trip_party_financials tf ON t.id = tf.trip_id
    WHERE tf.tds_amount > 0 AND t.status != 'CANCELLED'
  `);

  return {
    items: result.rows,
    total: parseFloat(countRes.rows[0].total || '0'),
    count: parseInt(countRes.rows[0].count, 10)
  };
};

export const getBillReconciliation = async (query: any) => {
  const limit = query.pageSize ? parseInt(query.pageSize, 10) : 50;
  const page = query.page ? parseInt(query.page, 10) : 1;
  const offset = (page - 1) * limit;

  // We want to list bills and their payments. The database already computes total_amount and balance_amount for bills.
  const queryStr = `
    SELECT b.id, b.bill_number, b.bill_status, b.bill_date, b.total_amount, b.balance_amount, p.name as party_name,
           (b.total_amount - b.balance_amount) as allocated_amount
    FROM bills b
    JOIN parties p ON b.party_id = p.id
    ORDER BY b.created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const result = await pool.query(queryStr, [limit, offset]);

  const countRes = await pool.query(`SELECT COUNT(*) as count FROM bills`);

  return {
    items: result.rows,
    count: parseInt(countRes.rows[0].count, 10)
  };
};

export const getFinancialYear = async (query: any) => {
  if (!query.financialYearId) {
    throw new Error('financialYearId is required');
  }

  // Gets fy details
  const fyRes = await pool.query('SELECT * FROM financial_years WHERE id = $1', [query.financialYearId]);
  if (!fyRes.rows.length) {
    throw new Error('Financial year not found');
  }
  const fy = fyRes.rows[0];

  // We can just call our other methods using fromDate and toDate from the fy.
  const reqQuery = {
    ...query,
    fromDate: fy.start_date.toISOString().split('T')[0],
    toDate: fy.end_date.toISOString().split('T')[0]
  };

  const summary = await getFinancialSummary(reqQuery);
  const pnl = await getPnl(reqQuery);
  
  return {
    financialYear: fy,
    summary,
    pnl
  };
};
