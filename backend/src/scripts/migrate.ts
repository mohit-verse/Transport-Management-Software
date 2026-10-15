import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { pool as defaultPool } from '../db';

export const CANONICAL_TABLES_001 = [
  'users',
  'user_sessions',
  'financial_years',
  'business_settings',
  'dynamic_field_definitions',
  'bill_templates',
  'bill_template_components',
  'bill_template_dynamic_fields',
  'bill_template_assets',
  'parties',
  'party_billing_configs',
  'vehicle_owners',
  'market_vehicles',
  'own_fleet_vehicles',
  'own_fleet_vehicle_status_history',
  'trips',
  'trip_destinations',
  'trip_party_financials',
  'trip_vehicle_owner_financials',
  'trip_other_charges',
  'trip_deductions',
  'trip_unloading_charges',
  'trip_pods',
  'trip_issues',
  'other_business_categories',
  'payments',
  'own_fleet_expense_details',
  'bill_numbering_series',
  'bills',
  'bill_items',
  'bill_versions',
  'bill_version_items',
  'payment_allocations',
  'payment_allocation_history',
  'payment_fifo_runs',
  'payment_fifo_run_allocations',
  'party_credits',
  'documents',
  'document_links',
  'audit_events',
];

export const CANONICAL_FUNCTIONS_001 = [
  'guard_trip_financial_cache',
  'recalculate_trip_financials',
  'refresh_trip_financial_cache',
  'guard_bill_derived_values',
  'recalculate_bill',
  'bill_item_set_active',
  'guard_bill_item_change',
  'sync_bill_item_activity',
  'refresh_bill_cache_from_source',
  'reverse_payment_allocations',
  'validate_payment_integrity',
  'guard_payment_entity_type_change',
  'validate_credit_utilization',
  'deferred_validate_credit_utilization',
  'reverse_credit_utilizations',
  'guard_active_credit_target_change',
  'deferred_validate_payment_integrity',
  'validate_bill_allocations',
  'validate_expense_payment',
  'validate_credit_source',
  'reject_core_delete',
  'guard_payment_reversal_history',
  'guard_allocation_reversal_history',
  'validate_fifo_mapping',
  'reject_historical_mutation',
  'guard_bill_version_snapshot',
  'capture_bill_template_snapshot',
];

export const CANONICAL_TRIGGERS_COUNT_001 = 63;
export const CANONICAL_DYNAMIC_FIELDS_COUNT = 86;

export async function runMigrations(customPool?: Pool) {
  const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
  const seedPath = path.resolve(__dirname, '../../../database/seed/dynamic_fields.seed.sql');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }

  const activePool = customPool || defaultPool;
  const client = await activePool.connect();
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

    // If schema_migrations is empty, check whether pre-existing schema should be baselined
    if (appliedSet.size === 0) {
      // Check total base tables present in public schema (excluding schema_migrations)
      const existingTablesRes = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'
        ORDER BY table_name;
      `);
      const existingTableCount = existingTablesRes.rows.length;

      if (existingTableCount > 0) {
        // A pre-existing database was found. Perform comprehensive schema completeness validation.
        const existingTableSet = new Set(existingTablesRes.rows.map((r: any) => r.table_name));
        const missingTables = CANONICAL_TABLES_001.filter((t) => !existingTableSet.has(t));

        if (missingTables.length > 0) {
          throw new Error(
            `[migrate] Incomplete database schema detected (found ${existingTableCount}/${CANONICAL_TABLES_001.length} tables; missing: ${missingTables.slice(0, 5).join(', ')}${missingTables.length > 5 ? '...' : ''}). Automatic baselining aborted to protect data integrity.`
          );
        }

        // Verify all 27 application domain functions exist
        const funcsRes = await client.query(
          `SELECT routine_name FROM information_schema.routines 
           WHERE routine_schema = 'public' AND routine_name = ANY($1)`,
          [CANONICAL_FUNCTIONS_001]
        );
        const existingFuncSet = new Set(funcsRes.rows.map((r: any) => r.routine_name));
        const missingFuncs = CANONICAL_FUNCTIONS_001.filter((f) => !existingFuncSet.has(f));

        if (missingFuncs.length > 0) {
          throw new Error(
            `[migrate] Incomplete database schema detected: missing ${missingFuncs.length} required domain function(s) (${missingFuncs.slice(0, 5).join(', ')}). Automatic baselining aborted to protect data integrity.`
          );
        }

        // Verify triggers in pg_trigger (excluding internal foreign key triggers)
        const trigRes = await client.query(`
          SELECT count(*) as count 
          FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND NOT t.tgisinternal
        `);
        const existingTriggerCount = parseInt(trigRes.rows[0].count, 10);
        if (existingTriggerCount < CANONICAL_TRIGGERS_COUNT_001) {
          throw new Error(
            `[migrate] Incomplete database schema detected: found ${existingTriggerCount}/${CANONICAL_TRIGGERS_COUNT_001} required triggers. Automatic baselining aborted to protect data integrity.`
          );
        }

        // Verify required pgcrypto extension
        const extRes = await client.query("SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'");
        if (extRes.rows.length === 0) {
          throw new Error(
            '[migrate] Incomplete database schema detected: missing required "pgcrypto" extension. Automatic baselining aborted to protect data integrity.'
          );
        }

        // All schema completeness verification checks passed cleanly! Baseline 001_initial_schema.sql
        console.log('[migrate] Detected fully intact canonical pre-existing schema (40 tables, 27 functions, 63 triggers, pgcrypto). Baselining 001_initial_schema.sql...');
        await client.query("INSERT INTO schema_migrations (id) VALUES ('001_initial_schema.sql') ON CONFLICT DO NOTHING");
        appliedSet.add('001_initial_schema.sql');

        // Check if expiry_date column exists in documents table (002_add_document_expiry.sql)
        const checkExpiryCol = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'documents' AND column_name = 'expiry_date'
          );
        `);
        if (checkExpiryCol.rows[0].exists) {
          console.log('[migrate] Detected expiry_date column in documents. Baselining 002_add_document_expiry.sql...');
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

    // Ensure canonical dynamic fields are complete and transactionally seeded
    if (fs.existsSync(seedPath)) {
      const checkDynamicTable = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'dynamic_field_definitions'
        );
      `);
      if (checkDynamicTable.rows[0].exists) {
        const dynamicCountRes = await client.query('SELECT count(*) as count FROM dynamic_field_definitions');
        const currentCount = parseInt(dynamicCountRes.rows[0].count, 10);

        if (currentCount < CANONICAL_DYNAMIC_FIELDS_COUNT) {
          console.log(`[migrate] Incomplete dynamic field definitions (${currentCount}/${CANONICAL_DYNAMIC_FIELDS_COUNT}). Applying canonical seed transactionally...`);
          const seedSql = fs.readFileSync(seedPath, 'utf-8');
          await client.query('BEGIN');
          try {
            await client.query(seedSql);
            const verifyCountRes = await client.query('SELECT count(*) as count FROM dynamic_field_definitions');
            const newCount = parseInt(verifyCountRes.rows[0].count, 10);
            if (newCount < CANONICAL_DYNAMIC_FIELDS_COUNT) {
              throw new Error(
                `Dynamic field seeding incomplete: expected at least ${CANONICAL_DYNAMIC_FIELDS_COUNT}, found ${newCount}`
              );
            }
            await client.query('COMMIT');
            console.log(`[migrate] Canonical dynamic fields verified (${newCount} definitions active).`);
          } catch (seedErr: any) {
            await client.query('ROLLBACK').catch(() => {});
            throw new Error(`Failed to seed dynamic field definitions: ${seedErr.message}`);
          }
        } else {
          console.log(`[migrate] Canonical dynamic fields verified (${currentCount} definitions active).`);
        }
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
      defaultPool.end().then(() => process.exit(0));
    })
    .catch((err) => {
      console.error(`[migrate] ❌ Error: ${err.message}`);
      defaultPool.end().then(() => process.exit(1));
    });
}
