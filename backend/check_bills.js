const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres@localhost:5432/billing_scratch' });
pool.query('SELECT id, total_amount FROM bills').then(res => {
  console.log(res.rows);
  pool.end();
});
