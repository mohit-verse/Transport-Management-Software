import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';
import { seedDynamicFields } from '../src/modules/bill-templates/dynamic-fields.seeder';
import { CANONICAL_DYNAMIC_FIELDS } from '../src/modules/bill-templates/dynamic-fields.definitions';

let ownerToken: string;
let staffToken: string;
let caToken: string;
let ownerId: string;
let staffId: string;
let caId: string;

let partyId: string;
let fyId: string;
let templateId: string;
let assetId: string;
let numberingSeriesId: string;
let tripId: string;

beforeAll(async () => {
  // Truncate relevant tables
  await pool.query(
    'TRUNCATE users, vehicle_owners, market_vehicles, parties, party_billing_configs, bill_templates, bill_template_components, bill_template_dynamic_fields, bill_template_assets, dynamic_field_definitions, bill_numbering_series, financial_years, trips, trip_destinations, trip_party_financials, trip_pods, bills, bill_items, bill_versions, bill_version_items, payment_allocations, payments CASCADE'
  );

  ownerId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner User', 'OWNER', '9899000001', $1, true) RETURNING id",
      [await hashPassword('pass')]
    )
  ).rows[0].id;

  staffId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Staff User', 'STAFF', '9899000002', $1, true) RETURNING id",
      [await hashPassword('pass')]
    )
  ).rows[0].id;

  caId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('CA User', 'CA', '9899000003', $1, true) RETURNING id",
      [await hashPassword('pass')]
    )
  ).rows[0].id;

  const jwt = require('jsonwebtoken');
  const secret = require('../src/config').config.jwt.secret;
  ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, secret, { expiresIn: '1d' });
  staffToken = jwt.sign({ id: staffId, role: 'STAFF' }, secret, { expiresIn: '1d' });
  caToken = jwt.sign({ id: caId, role: 'CA' }, secret, { expiresIn: '1d' });

  fyId = (
    await pool.query(
      "INSERT INTO financial_years (code, start_date, end_date, is_active) VALUES ('FY26-27', '2026-04-01', '2027-03-31', true) RETURNING id"
    )
  ).rows[0].id;

  partyId = (
    await pool.query(
      "INSERT INTO parties (name, primary_mobile, party_type, gstin, full_address, city, state, pin_code, is_active) VALUES ('Tata Steel Logistics', '9820098200', 'COMPANY', '27AAACT0001A1Z', 'Steel Yard Road', 'Mumbai', 'Maharashtra', '400001', true) RETURNING id"
    )
  ).rows[0].id;

  const voId = (
    await pool.query("INSERT INTO vehicle_owners (name, mobile_number) VALUES ('Test Owner', '9811198111') RETURNING id")
  ).rows[0].id;

  const mvId = (
    await pool.query(
      "INSERT INTO market_vehicles (vehicle_number, vehicle_owner_id, is_active) VALUES ('MH12AB9999', $1, true) RETURNING id",
      [voId]
    )
  ).rows[0].id;

  tripId = (
    await pool.query(
      "INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) VALUES ('TRP-TMP-001', $1, 'COMPANY', 'MARKET', $2, 'Jamshedpur', 'Mumbai', 'COMPLETED', '2026-10-01', $3) RETURNING id",
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;

  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [tripId]);
  await pool.query(
    'INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 50000) ON CONFLICT (trip_id) DO UPDATE SET freight_amount = EXCLUDED.freight_amount',
    [tripId]
  );
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 4K-B — Dynamic Fields Registry & Seeding', () => {
  it('seeds canonical dynamic fields idempotently with complete 14 categories', async () => {
    const seededFirst = await seedDynamicFields();
    expect(seededFirst).toBe(CANONICAL_DYNAMIC_FIELDS.length);

    // Run again to verify idempotency
    const seededSecond = await seedDynamicFields();
    expect(seededSecond).toBe(CANONICAL_DYNAMIC_FIELDS.length);

    const countRes = await pool.query('SELECT COUNT(*)::int as cnt FROM dynamic_field_definitions WHERE is_active = true');
    expect(countRes.rows[0].cnt).toBe(CANONICAL_DYNAMIC_FIELDS.length);
  });

  it('GET /api/dynamic-fields returns all approved fields', async () => {
    const res = await request(app)
      .get('/api/dynamic-fields')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(CANONICAL_DYNAMIC_FIELDS.length);
  });

  it('supports filtering by source_entity and search keyword', async () => {
    const partyRes = await request(app)
      .get('/api/dynamic-fields?source_entity=PARTY')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(partyRes.status).toBe(200);
    expect(partyRes.body.data.length).toBe(10);
    expect(partyRes.body.data.every((f: any) => f.source_entity === 'PARTY')).toBe(true);

    const searchRes = await request(app)
      .get('/api/dynamic-fields?search=freight')
      .set('Authorization', `Bearer ${caToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('supports filtering repeatable destination fields', async () => {
    const repRes = await request(app)
      .get('/api/dynamic-fields?is_repeatable=true')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(repRes.status).toBe(200);
    expect(repRes.body.data.length).toBe(5);
    expect(repRes.body.data.every((f: any) => f.source_entity === 'JOURNEY')).toBe(true);
  });
});

describe('Phase 4K-B — Bill Templates CRUD & Component Persistence', () => {
  let partyNameDefId: string;
  let tripNumDefId: string;

  beforeAll(async () => {
    const defs = await pool.query(
      "SELECT id, field_key FROM dynamic_field_definitions WHERE source_entity IN ('PARTY', 'TRIP') AND field_key IN ('name', 'trip_number')"
    );
    for (const r of defs.rows) {
      if (r.field_key === 'name') partyNameDefId = r.id;
      if (r.field_key === 'trip_number') tripNumDefId = r.id;
    }
  });

  it('creates a structured bill template with components and dynamic field bindings (Owner-only)', async () => {
    const payload = {
      name: 'Standard Corporate Invoice Template',
      template_type: 'CONSOLIDATED',
      status: 'ACTIVE',
      layout_json: {
        page_size: 'A4',
        orientation: 'PORTRAIT',
        margin_top: 20,
        margin_bottom: 20,
        margin_left: 20,
        margin_right: 20
      },
      components: [
        {
          component_type: 'HEADER',
          component_key: 'company_header',
          position_x: 20,
          position_y: 20,
          width: 550,
          height: 60,
          style_json: { font_size: 16, bold: true },
          content_json: { title: 'Shri Sanwariya Road Lines' }
        },
        {
          component_type: 'TEXT',
          component_key: 'bill_to_party',
          position_x: 20,
          position_y: 90,
          width: 250,
          height: 40,
          style_json: { font_size: 10 },
          content_json: { label: 'Billed To', binding: '{{party.name}}' }
        },
        {
          component_type: 'TABLE',
          component_key: 'trip_items_table',
          position_x: 20,
          position_y: 140,
          width: 550,
          height: 300,
          style_json: { border_width: 1 },
          content_json: { columns: ['Seq', 'Trip No', 'Vehicle', 'Amount'] }
        }
      ],
      dynamic_fields: [
        {
          field_definition_id: partyNameDefId,
          binding_path: 'party.name',
          display_label: 'Billed Party Name',
          is_repeatable: false
        },
        {
          field_definition_id: tripNumDefId,
          binding_path: 'trip.trip_number',
          display_label: 'Trip Identifier',
          is_repeatable: true
        }
      ]
    };

    const res = await request(app)
      .post('/api/bill-templates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('Standard Corporate Invoice Template');
    expect(res.body.data.components.length).toBe(3);
    expect(res.body.data.dynamic_fields.length).toBe(2);

    templateId = res.body.data.id;
  });

  it('rejects duplicate template name (409 Conflict)', async () => {
    const res = await request(app)
      .post('/api/bill-templates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Standard Corporate Invoice Template',
        template_type: 'INDIVIDUAL'
      });

    expect(res.status).toBe(409);
  });

  it('rejects duplicate component keys within the same template (400 Bad Request)', async () => {
    const res = await request(app)
      .post('/api/bill-templates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Unique Test Template 2',
        template_type: 'INDIVIDUAL',
        components: [
          { component_type: 'TEXT', component_key: 'duplicate_key' },
          { component_type: 'TABLE', component_key: 'duplicate_key' }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Duplicate component_key');
  });

  it('rejects dynamic field reference to non-existent definition (400 Bad Request)', async () => {
    const res = await request(app)
      .post('/api/bill-templates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Unique Test Template 3',
        template_type: 'INDIVIDUAL',
        dynamic_fields: [
          {
            field_definition_id: 'a0000000-0000-0000-0000-000000000000',
            binding_path: 'invalid.field'
          }
        ]
      });

    expect(res.status).toBe(400);
  });

  it('retrieves template details including components, dynamic fields, and assets', async () => {
    const res = await request(app)
      .get(`/api/bill-templates/${templateId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(templateId);
    expect(res.body.data.components.length).toBe(3);
    expect(res.body.data.dynamic_fields.length).toBe(2);
  });

  it('lists templates with summary counts', async () => {
    const res = await request(app)
      .get('/api/bill-templates')
      .set('Authorization', `Bearer ${caToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const item = res.body.data.find((t: any) => t.id === templateId);
    expect(item).toBeDefined();
    expect(item.component_count).toBe(3);
    expect(item.dynamic_field_count).toBe(2);
  });

  it('updates template metadata and replaces child components atomically', async () => {
    const updatePayload = {
      name: 'Standard Corporate Invoice Template (Updated)',
      layout_json: { page_size: 'LETTER', orientation: 'PORTRAIT' },
      components: [
        {
          component_type: 'HEADER',
          component_key: 'main_header_v2',
          content_json: { title: 'Shri Sanwariya Road Lines Corporate' }
        }
      ]
    };

    const res = await request(app)
      .patch(`/api/bill-templates/${templateId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Standard Corporate Invoice Template (Updated)');
    expect(res.body.data.components.length).toBe(1);
    expect(res.body.data.components[0].component_key).toBe('main_header_v2');
  });

  it('enforces RBAC: Staff and CA cannot create or update templates (403 Forbidden)', async () => {
    const staffPost = await request(app)
      .post('/api/bill-templates')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Staff Template', template_type: 'INDIVIDUAL' });
    expect(staffPost.status).toBe(403);

    const caPatch = await request(app)
      .patch(`/api/bill-templates/${templateId}`)
      .set('Authorization', `Bearer ${caToken}`)
      .send({ name: 'CA Renamed Template' });
    expect(caPatch.status).toBe(403);
  });
});

describe('Phase 4K-B — Template Asset Management', () => {
  it('uploads an asset with SHA-256 checksum and associates it with the template (Owner-only)', async () => {
    const fakeLogoBase64 = Buffer.from('FAKE_PNG_BINARY_CONTENT_FOR_TESTING').toString('base64');

    const res = await request(app)
      .post(`/api/bill-templates/${templateId}/assets`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        asset_type: 'LOGO',
        file_name: 'ssrl_logo.png',
        file_content_base64: fakeLogoBase64,
        mime_type: 'image/png',
        width: 120,
        height: 60
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.file_name).toBe('ssrl_logo.png');
    expect(res.body.data.content_checksum).toBeDefined();
    expect(res.body.data.storage_key).toBeDefined();

    assetId = res.body.data.id;
  });

  it('rejects duplicate asset file_name on the same template (409 Conflict)', async () => {
    const res = await request(app)
      .post(`/api/bill-templates/${templateId}/assets`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        asset_type: 'LOGO',
        file_name: 'ssrl_logo.png'
      });

    expect(res.status).toBe(409);
  });

  it('streams uploaded asset file with correct headers and access check', async () => {
    const res = await request(app)
      .get(`/api/bill-templates/${templateId}/assets/${assetId}/file`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body.toString('utf8')).toBe('FAKE_PNG_BINARY_CONTENT_FOR_TESTING');
  });

  it('enforces RBAC: Staff cannot upload or delete assets (403 Forbidden)', async () => {
    const staffUpload = await request(app)
      .post(`/api/bill-templates/${templateId}/assets`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ asset_type: 'STAMP', file_name: 'stamp.png' });
    expect(staffUpload.status).toBe(403);

    const staffDelete = await request(app)
      .delete(`/api/bill-templates/${templateId}/assets/${assetId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffDelete.status).toBe(403);
  });
});

describe('Phase 4K-B — Party Billing Configuration Correction', () => {
  it('updates party billing configuration in party_billing_configs table (Owner-only)', async () => {
    const configPayload = {
      billing_mode: 'CONSOLIDATED',
      default_template_id: templateId,
      tds_treatment: 'SECTION_194C',
      required_fields: { require_lr_number: true },
      numbering_series_policy: { auto_select: true }
    };

    const res = await request(app)
      .patch(`/api/parties/${partyId}/billing-config`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(configPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.billing_configuration).toBeDefined();
    expect(res.body.data.billing_configuration.billing_mode).toBe('CONSOLIDATED');
    expect(res.body.data.billing_configuration.default_template_id).toBe(templateId);

    // Verify database row in party_billing_configs
    const dbRes = await pool.query('SELECT * FROM party_billing_configs WHERE party_id = $1', [partyId]);
    expect(dbRes.rowCount).toBe(1);
    expect(dbRes.rows[0].billing_mode).toBe('CONSOLIDATED');
    expect(dbRes.rows[0].default_template_id).toBe(templateId);
  });

  it('rejects invalid default_template_id (400 Bad Request)', async () => {
    const res = await request(app)
      .patch(`/api/parties/${partyId}/billing-config`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        default_template_id: 'b0000000-0000-0000-0000-000000000000'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Referenced default billing template not found');
  });

  it('enforces RBAC: Staff cannot update party billing configuration (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/parties/${partyId}/billing-config`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ billing_mode: 'INDIVIDUAL' });

    expect(res.status).toBe(403);
  });
});

describe('Phase 4K-B — Numbering Series Configuration APIs', () => {
  it('creates a new numbering series for a party and FY (Owner-only)', async () => {
    const res = await request(app)
      .post('/api/numbering-series')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        party_id: partyId,
        financial_year_id: fyId,
        series_code: 'SER-2026',
        prefix: 'SRL/26-27/'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.series_code).toBe('SER-2026');
    expect(res.body.data.prefix).toBe('SRL/26-27/');
    expect(res.body.data.current_number).toBe(0);

    numberingSeriesId = res.body.data.id;
  });

  it('rejects duplicate series code for same party and FY (409 Conflict)', async () => {
    const res = await request(app)
      .post('/api/numbering-series')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        party_id: partyId,
        financial_year_id: fyId,
        series_code: 'SER-2026',
        prefix: 'SRL/ALT/'
      });

    expect(res.status).toBe(409);
  });

  it('lists numbering series with party name and FY code', async () => {
    const res = await request(app)
      .get(`/api/numbering-series?party_id=${partyId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].party_name).toBe('Tata Steel Logistics');
    expect(res.body.data[0].financial_year_code).toBe('FY26-27');
  });

  it('updates prefix when no bills have been generated', async () => {
    const res = await request(app)
      .patch(`/api/numbering-series/${numberingSeriesId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ prefix: 'SRL/26-27/CORP/' });

    expect(res.status).toBe(200);
    expect(res.body.data.prefix).toBe('SRL/26-27/CORP/');
  });

  it('deactivates numbering series (Owner-only)', async () => {
    const res = await request(app)
      .post(`/api/numbering-series/${numberingSeriesId}/deactivate`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);

    // Re-activate for bill generation test
    await request(app)
      .patch(`/api/numbering-series/${numberingSeriesId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ is_active: true });
  });

  it('enforces RBAC: Staff cannot create, update, or deactivate numbering series (403 Forbidden)', async () => {
    const staffCreate = await request(app)
      .post('/api/numbering-series')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ party_id: partyId, financial_year_id: fyId, series_code: 'S2', prefix: 'P' });
    expect(staffCreate.status).toBe(403);

    const staffDeact = await request(app)
      .post(`/api/numbering-series/${numberingSeriesId}/deactivate`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffDeact.status).toBe(403);
  });
});

describe('Phase 4K-B — Template Snapshot Capture & Historical Immutability', () => {
  let generatedBillId: string;
  let originalSnapshot: any;

  it('bill generation automatically captures configured party default template snapshot via database trigger', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        party_id: partyId,
        financial_year_id: fyId,
        numbering_series_id: numberingSeriesId,
        billing_mode: 'CONSOLIDATED',
        bill_date: '2026-10-15',
        trip_ids: [tripId],
        template_snapshot: {}
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bill).toBeDefined();

    generatedBillId = res.body.data.bill.id;

    // Check captured snapshot in bill_versions table
    const vRes = await pool.query(
      'SELECT version_number, template_id, template_snapshot FROM bill_versions WHERE bill_id = $1 AND version_number = 1',
      [generatedBillId]
    );

    expect(vRes.rowCount).toBe(1);
    const versionRow = vRes.rows[0];
    expect(versionRow.template_id).toBe(templateId);

    // The trigger automatically assembled template, layout, components, assets, and dynamic_field_definitions
    const snapshot = versionRow.template_snapshot;
    expect(snapshot.template).toBeDefined();
    expect(snapshot.layout).toBeDefined();
    expect(snapshot.components).toBeDefined();
    expect(Array.isArray(snapshot.components)).toBe(true);
    expect(snapshot.assets).toBeDefined();
    expect(Array.isArray(snapshot.assets)).toBe(true);
    expect(snapshot.dynamic_field_definitions).toBeDefined();
    expect(Array.isArray(snapshot.dynamic_field_definitions)).toBe(true);

    originalSnapshot = snapshot;
  });

  it('subsequent template mutations do NOT alter the historical captured snapshot', async () => {
    // Mutate the original template
    await request(app)
      .patch(`/api/bill-templates/${templateId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Template Mutated For Future Bills',
        layout_json: { mutated_flag: true, new_property: 999 },
        components: [
          {
            component_type: 'FOOTER',
            component_key: 'brand_new_footer_component',
            content_json: { footer_text: 'Brand New Footer' }
          }
        ]
      });

    // Verify historical version snapshot remains identical
    const vRes = await pool.query(
      'SELECT template_snapshot FROM bill_versions WHERE bill_id = $1 AND version_number = 1',
      [generatedBillId]
    );

    const historicalSnapshot = vRes.rows[0].template_snapshot;
    expect(historicalSnapshot).toEqual(originalSnapshot);
  });
});
