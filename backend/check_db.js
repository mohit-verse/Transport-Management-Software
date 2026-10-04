const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres@localhost:5432/billing_scratch' });
pool.query('SELECT trip_id, freight_amount, receivable_amount FROM trip_party_financials').then(res => {
  console.log(res.rows);
  pool.end();
});
