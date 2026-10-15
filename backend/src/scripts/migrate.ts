import fs from 'fs';
import path from 'path';
import { pool } from '../db';

export async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../../../database/migrations');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }

  const client = await pool.connect();
  try {
    // Ensure migration tracking table exists without altering any business tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Get list of already applied migrations
    const appliedRes = await client.query('SELECT id FROM schema_migrations ORDER BY id ASC');
    const appliedSet = new Set(appliedRes.rows.map((r: any) => r.id));

    // If tables already exist but schema_migrations is empty, baseline previously applied migrations
    if (appliedSet.size === 0) {
      const checkTableRes = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'users'
        );
      `);
      const tablesExist = checkTableRes.rows[0].exists;

      if (tablesExist) {
        console.log('[migrate] Detected pre-existing schema. Baselining existing migrations into schema_migrations...');
        await client.query("INSERT INTO schema_migrations (id) VALUES ('001_initial_schema.sql') ON CONFLICT DO NOTHING");
        appliedSet.add('001_initial_schema.sql');

        // Check if expiry_date column exists in documents table
        const checkExpiryCol = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'documents' AND column_name = 'expiry_date'
          );
        `);
        if (checkExpiryCol.rows[0].exists) {
          await client.query("INSERT INTO schema_migrations (id) VALUES ('002_add_document_expiry.sql') ON CONFLICT DO NOTHING");
          appliedSet.add('002_add_document_expiry.sql');
        }
      }
    }

    // Read and sort migration files
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`[migrate] Discovered ${files.length} migration file(s) in ${migrationsDir}`);

    let newlyAppliedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[migrate] Already applied: ${file}`);
        continue;
      }

      console.log(`[migrate] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Execute migration inside an atomic transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] Successfully applied: ${file}`);
        newlyAppliedCount++;
      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Failed to apply migration "${file}": ${err.message}`);
      }
    }

    console.log(`[migrate] Migration run complete. Newly applied: ${newlyAppliedCount}.`);
    return { newlyAppliedCount, total: files.length };
  } finally {
    client.release();
  }
}

// CLI execution handler
if (require.main === module) {
  runMigrations()
    .then(() => {
      pool.end().then(() => process.exit(0));
    })
    .catch((err) => {
      console.error(`[migrate] ❌ Error: ${err.message}`);
      pool.end().then(() => process.exit(1));
    });
}
