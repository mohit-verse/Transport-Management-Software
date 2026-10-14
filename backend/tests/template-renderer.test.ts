import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';
import { generateBillPdfBuffer } from '../src/modules/bills/bill-pdf.generator';
import {
  resolveFieldValue,
  resolveTextTemplate,
  resolveDynamicFields,
  formatCurrency,
  formatDate,
  formatBoolean,
  formatNumber,
  amountToWordsINR
} from '../src/modules/bill-templates/dynamic-fields.resolver';
import { seedDynamicFields } from '../src/modules/bill-templates/dynamic-fields.seeder';

let ownerToken: string;
let staffToken: string;
let caToken: string;
let ownerId: string;
let staffId: string;
let caId: string;

let partyId: string;
let fyId: string;
let templateId: string;
let numberingSeriesId: string;
let tripId: string;
let billId: string;

beforeAll(async () => {
  // Truncate relevant tables
  await pool.query(
    'TRUNCATE users, vehicle_owners, market_vehicles, parties, party_billing_configs, bill_templates, bill_template_components, bill_template_dynamic_fields, bill_template_assets, dynamic_field_definitions, bill_numbering_series, financial_years, trips, trip_destinations, trip_party_financials, trip_pods, bills, bill_items, bill_versions, bill_version_items, payment_allocations, payments CASCADE'
  );

  ownerId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner Renderer', 'OWNER', '9899110001', $1, true) RETURNING id",
      [await hashPassword('pass')]
    )
  ).rows[0].id;

  staffId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Staff Renderer', 'STAFF', '9899110002', $1, true) RETURNING id",
      [await hashPassword('pass')]
    )
  ).rows[0].id;

  caId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('CA Renderer', 'CA', '9899110003', $1, true) RETURNING id",
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
      "INSERT INTO parties (name, primary_mobile, party_type, gstin, full_address, city, state, pin_code, is_active) VALUES ('Adani Logistics Ltd', '9820011223', 'COMPANY', '24AAACA0001A1Z', 'Mundra Port SEZ', 'Mundra', 'Gujarat', '370421', true) RETURNING id"
    )
  ).rows[0].id;

  const voId = (
    await pool.query("INSERT INTO vehicle_owners (name, mobile_number) VALUES ('Rajesh Transport', '9811122334') RETURNING id")
  ).rows[0].id;

  const mvId = (
    await pool.query(
      "INSERT INTO market_vehicles (vehicle_number, vehicle_owner_id, is_active) VALUES ('GJ12AB1234', $1, true) RETURNING id",
      [voId]
    )
  ).rows[0].id;

  tripId = (
    await pool.query(
      "INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) VALUES ('TRP-REN-001', $1, 'COMPANY', 'MARKET', $2, 'Mundra', 'Jaipur', 'COMPLETED', '2026-10-01', $3) RETURNING id",
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;

  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [tripId]);
  await pool.query(
    'INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 75000) ON CONFLICT (trip_id) DO UPDATE SET freight_amount = EXCLUDED.freight_amount',
    [tripId]
  );

  const nsRes = await pool.query(
    "INSERT INTO bill_numbering_series (party_id, financial_year_id, series_code, prefix, current_number, is_active, created_by) VALUES ($1, $2, 'SRL/ADANI', 'SRL/26-27/', 1, true, $3) RETURNING id",
    [partyId, fyId, ownerId]
  );
  numberingSeriesId = nsRes.rows[0].id;

  await seedDynamicFields();
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 4K-C — Dynamic Fields Resolution & Formatting', () => {
  it('formats currency with Indian comma grouping and INR prefix', () => {
    expect(formatCurrency(1000)).toBe('INR 1,000.00');
    expect(formatCurrency(1234567.89)).toBe('INR 12,34,567.89');
    expect(formatCurrency(0)).toBe('INR 0.00');
    expect(formatCurrency(null)).toBe('INR 0.00');
  });

  it('formats dates in ISO YYYY-MM-DD', () => {
    expect(formatDate('2026-10-15T10:30:00Z')).toBe('2026-10-15');
    expect(formatDate('2026-04-01')).toBe('2026-04-01');
    expect(formatDate(null)).toBe('-');
  });

  it('formats booleans as Yes / No', () => {
    expect(formatBoolean(true)).toBe('Yes');
    expect(formatBoolean(false)).toBe('No');
    expect(formatBoolean('true')).toBe('Yes');
    expect(formatBoolean(null)).toBe('-');
  });

  it('formats numbers with Indian locale formatting', () => {
    expect(formatNumber(1250000)).toBe('12,50,000');
    expect(formatNumber(null)).toBe('-');
  });

  it('resolves canonical dynamic fields across multiple entities safely', () => {
    const context = {
      party: {
        name: 'Adani Logistics Ltd',
        gstin: '24AAACA0001A1Z',
        tds_applicable: true
      },
      bill: {
        bill_number: 'SRL/26-27/001',
        bill_date: '2026-10-15',
        total_amount: 75000,
        paid_amount: 0,
        balance_amount: 75000
      },
      trip: {
        trip_number: 'TRP-REN-001',
        trip_type: 'COMPANY',
        freight_amount: 75000
      },
      vehicle: {
        vehicle_number: 'GJ12AB1234'
      }
    };

    expect(resolveFieldValue('party.name', context)).toBe('Adani Logistics Ltd');
    expect(resolveFieldValue('party.gstin', context)).toBe('24AAACA0001A1Z');
    expect(resolveFieldValue('party.tds_applicable', context)).toBe('Yes');
    expect(resolveFieldValue('billing.bill_number', context)).toBe('SRL/26-27/001');
    expect(resolveFieldValue('bill.bill_number', context)).toBe('SRL/26-27/001');
    expect(resolveFieldValue('billing.total_amount', context)).toBe('INR 75,000.00');
    expect(resolveFieldValue('trip.trip_number', context)).toBe('TRP-REN-001');
    expect(resolveFieldValue('vehicle.vehicle_number', context)).toBe('GJ12AB1234');
    expect(resolveFieldValue('nonexistent.field', context)).toBe('');
  });

  it('interpolates placeholders inside text templates', () => {
    const context = {
      party: { name: 'Adani Logistics Ltd' },
      bill: { bill_number: 'SRL/26-27/001', total_amount: 75000 }
    };

    const template = 'Invoice {{bill.bill_number}} for {{party.name}} total {{bill.total_amount}}';
    const resolved = resolveTextTemplate(template, context);
    expect(resolved).toBe('Invoice SRL/26-27/001 for Adani Logistics Ltd total INR 75,000.00');
  });

  it('resolves all canonical dynamic fields with resolveDynamicFields without throwing', () => {
    const dict = resolveDynamicFields(
      { bill_number: 'SRL/26-27/001', total_amount: 75000 },
      { name: 'Adani Logistics Ltd' }
    );
    expect(dict).toBeDefined();
    expect(dict['party.name']).toBe('Adani Logistics Ltd');
    expect(dict['billing.bill_number']).toBe('SRL/26-27/001');
  });
});

describe('Phase 4K-C — Pure PDF-1.4 Template Renderer Engine', () => {
  it('generates a valid PDF-1.4 binary buffer for a structured bill template', () => {
    const pdfData = {
      id: 'test-bill-id',
      bill_number: 'SRL/26-27/001',
      bill_date: '2026-10-15',
      bill_status: 'GENERATED',
      billing_mode: 'CONSOLIDATED',
      party_name: 'Adani Logistics Ltd',
      party: {
        name: 'Adani Logistics Ltd',
        gstin: '24AAACA0001A1Z',
        address: 'Mundra Port SEZ, Mundra'
      },
      total_amount: 75000,
      paid_amount: 0,
      balance_amount: 75000,
      version_number: 1,
      version_label: 'Version 1',
      template_snapshot: {
        template: { name: 'Standard Transport Bill', template_type: 'CONSOLIDATED' },
        layout: { page_size: 'A4', orientation: 'PORTRAIT', margins: { top: 20, right: 20, bottom: 20, left: 20 } },
        components: [
          {
            component_type: 'HEADER',
            component_key: 'hdr',
            position_x: 20,
            position_y: 20,
            width: 555,
            height: 50,
            style_json: { font_size: 16, font_weight: 'bold', text_align: 'center' },
            content_json: { text: 'SHRI SANWARIYA ROAD LINES', subtitle: 'Transport Contractors' }
          },
          {
            component_type: 'LINE',
            component_key: 'line_top',
            position_x: 20,
            position_y: 75,
            width: 555,
            height: 1,
            style_json: { stroke_color: '#000000', stroke_width: 1 }
          },
          {
            component_type: 'TEXT',
            component_key: 'meta_left',
            position_x: 20,
            position_y: 85,
            width: 270,
            height: 40,
            content_json: { template_text: 'Bill No: {{bill.bill_number}}\nDate: {{bill.bill_date}}' }
          },
          {
            component_type: 'TEXT',
            component_key: 'meta_right',
            position_x: 300,
            position_y: 85,
            width: 270,
            height: 40,
            content_json: { template_text: 'Billed To: {{party.name}}\nGSTIN: {{party.gstin}}' }
          },
          {
            component_type: 'TABLE',
            component_key: 'items_tbl',
            position_x: 20,
            position_y: 135,
            width: 555,
            height: 400,
            content_json: {
              columns: [
                { key: 'sr_no', label: 'Sr', width: 30 },
                { key: 'trip_number', label: 'Trip No', width: 85 },
                { key: 'vehicle_number', label: 'Vehicle No', width: 90 },
                { key: 'route', label: 'Route', width: 150 },
                { key: 'line_amount', label: 'Amount (INR)', width: 100 }
              ]
            }
          },
          {
            component_type: 'FOOTER',
            component_key: 'ftr',
            position_x: 20,
            position_y: 650,
            width: 555,
            height: 40,
            content_json: { text: 'Computer generated bill. No signature required.' }
          }
        ]
      },
      items: [
        {
          sequence_no: 1,
          trip_number: 'TRP-REN-001',
          vehicle_number: 'GJ12AB1234',
          description: 'Mundra to Jaipur',
          line_amount: 75000
        }
      ]
    };

    const pdfBuffer = generateBillPdfBuffer(pdfData);
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);

    const pdfString = pdfBuffer.toString('utf-8');
    expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfString).toContain('/Root 1 0 R');
    expect(pdfString).toContain('startxref');
    expect(pdfString).toContain('%%EOF');
    expect(pdfString).toContain('SHRI SANWARIYA ROAD LINES');
    expect(pdfString).toContain('Adani Logistics Ltd');
    expect(pdfString).toContain('TRP-REN-001');
  });

  it('handles multi-page table overflow with continuation headers and page numbering', () => {
    // Generate 35 trip items to force multi-page layout
    const items = [];
    for (let i = 1; i <= 35; i++) {
      items.push({
        sequence_no: i,
        trip_number: `TRP-REN-${String(i).padStart(3, '0')}`,
        vehicle_number: `GJ12AB${1000 + i}`,
        description: `Mundra to Destination ${i}`,
        line_amount: 50000 + i * 100
      });
    }

    const pdfData = {
      id: 'multi-page-bill-id',
      bill_number: 'SRL/26-27/MULTI-001',
      bill_date: '2026-10-15',
      bill_status: 'GENERATED',
      billing_mode: 'CONSOLIDATED',
      party_name: 'Adani Logistics Ltd',
      total_amount: 1750000,
      paid_amount: 0,
      balance_amount: 1750000,
      version_number: 1,
      version_label: 'Version 1',
      template_snapshot: {
        template: { name: 'Multi-Page Consolidated Template', template_type: 'CONSOLIDATED' },
        layout: { page_size: 'A4', orientation: 'PORTRAIT' },
        components: [
          {
            component_type: 'HEADER',
            component_key: 'hdr',
            position_x: 20,
            position_y: 20,
            width: 555,
            height: 40,
            content_json: { text: 'SHRI SANWARIYA ROAD LINES' }
          },
          {
            component_type: 'TABLE',
            component_key: 'items_tbl',
            position_x: 20,
            position_y: 70,
            width: 555,
            height: 600,
            content_json: {
              columns: [
                { key: 'sr_no', label: 'Sr', width: 30 },
                { key: 'trip_number', label: 'Trip No', width: 90 },
                { key: 'vehicle_number', label: 'Vehicle No', width: 90 },
                { key: 'description', label: 'Route', width: 140 },
                { key: 'line_amount', label: 'Amount', width: 90 }
              ]
            }
          }
        ]
      },
      items
    };

    const pdfBuffer = generateBillPdfBuffer(pdfData);
    const pdfString = pdfBuffer.toString('utf-8');

    // Confirm multiple page objects were generated
    const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
    expect(pageMatches).not.toBeNull();
    expect(pageMatches!.length).toBeGreaterThanOrEqual(2);

    // Confirm continuation header and page numbers exist
    expect(pdfString).toContain('Continuation');
    expect(pdfString).toContain('Page 1 of');
    expect(pdfString).toContain('Page 2 of');
    // Confirm all 35 trips are rendered without truncation
    expect(pdfString).toContain('TRP-REN-001');
    expect(pdfString).toContain('TRP-REN-035');
  });
});

describe('Phase 4K-C — Non-Mutating Template Preview API', () => {
  it('previews in-memory draft template as PDF stream with 200 (Owner)', async () => {
    // Record current row counts in DB to verify non-mutation
    const initialTemplatesCount = (await pool.query('SELECT COUNT(*)::int as c FROM bill_templates')).rows[0].c;
    const initialBillsCount = (await pool.query('SELECT COUNT(*)::int as c FROM bills')).rows[0].c;

    const res = await request(app)
      .post('/api/bill-templates/preview')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        template_type: 'CONSOLIDATED',
        layout_json: { page_size: 'A4', orientation: 'PORTRAIT' },
        components: [
          {
            component_type: 'HEADER',
            component_key: 'hdr',
            position_x: 20,
            position_y: 20,
            width: 555,
            height: 50,
            content_json: { text: 'PREVIEW TRANSPORT BILL' }
          }
        ],
        format: 'pdf'
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('inline');
    expect(res.body).toBeDefined();

    // Verify ZERO DB mutations
    const finalTemplatesCount = (await pool.query('SELECT COUNT(*)::int as c FROM bill_templates')).rows[0].c;
    const finalBillsCount = (await pool.query('SELECT COUNT(*)::int as c FROM bills')).rows[0].c;
    expect(finalTemplatesCount).toBe(initialTemplatesCount);
    expect(finalBillsCount).toBe(initialBillsCount);
  });

  it('previews draft template in json format with resolved dynamic fields', async () => {
    const res = await request(app)
      .post('/api/bill-templates/preview')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        template_type: 'CONSOLIDATED',
        components: [],
        format: 'json'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.format).toBe('json');
    expect(res.body.data.resolved_dynamic_fields).toBeDefined();
    expect(res.body.data.resolved_dynamic_fields['party.name']).toBeDefined();
  });

  it('rejects preview request by CA role with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/bill-templates/preview')
      .set('Authorization', `Bearer ${caToken}`)
      .send({ format: 'pdf' });

    expect(res.status).toBe(403);
  });

  it('rejects preview request without authentication with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/bill-templates/preview')
      .send({ format: 'pdf' });

    expect(res.status).toBe(401);
  });
});

describe('Phase 4K-C — Reference Template Import & Automatic Reconstruction', () => {
  it('imports vector PDF and extracts draft components with high confidence', async () => {
    // Construct a minimal vector PDF containing readable text
    const samplePdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length 120 >> stream
BT
/F1 14 Tf
20 800 Td
(SHRI SANWARIYA ROAD LINES) Tj
0 -20 Td
(TRANSPORT CONTRACTOR) Tj
0 -20 Td
(INVOICE / BILL) Tj
0 -20 Td
(CONSIGNOR DETAILS) Tj
0 -20 Td
(TOTAL AMOUNT) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000213 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
385
%%EOF`;

    const base64Pdf = Buffer.from(samplePdf).toString('base64');

    const res = await request(app)
      .post('/api/bill-templates/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        file_name: 'reference_bill.pdf',
        file_content_base64: base64Pdf,
        mime_type: 'application/pdf'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.components).toBeDefined();
    expect(res.body.data.components.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data.dynamic_fields).toBeDefined();
    expect(res.body.data.confidence).toBe('HIGH');
    expect(res.body.data.warnings).toBeDefined();
  });

  it('imports raster PNG image and falls back to standard transport bill geometry with warnings', async () => {
    // 8-byte PNG signature + empty IHDR dummy
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const base64Png = pngHeader.toString('base64');

    const res = await request(app)
      .post('/api/bill-templates/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        file_name: 'scanned_bill.png',
        file_content_base64: base64Png,
        mime_type: 'image/png'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.confidence).toBe('MEDIUM');
    expect(res.body.data.warnings[0]).toContain('Raster image');
    expect(res.body.data.components.length).toBeGreaterThan(0);
  });

  it('rejects file with invalid magic bytes (e.g. text file masquerading as PDF)', async () => {
    const fakePdf = Buffer.from('NOT A PDF FILE AT ALL').toString('base64');

    const res = await request(app)
      .post('/api/bill-templates/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        file_name: 'fake.pdf',
        file_content_base64: fakePdf,
        mime_type: 'application/pdf'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects import request by non-owner roles (Staff & CA)', async () => {
    const resStaff = await request(app)
      .post('/api/bill-templates/import')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        file_name: 'doc.pdf',
        file_content_base64: Buffer.from('%PDF-1.4').toString('base64'),
        mime_type: 'application/pdf'
      });

    expect(resStaff.status).toBe(403);

    const resCa = await request(app)
      .post('/api/bill-templates/import')
      .set('Authorization', `Bearer ${caToken}`)
      .send({
        file_name: 'doc.pdf',
        file_content_base64: Buffer.from('%PDF-1.4').toString('base64'),
        mime_type: 'application/pdf'
      });

    expect(resCa.status).toBe(403);
  });
});

describe('Phase 4K-C — Historical PDF Immutability Against Template Modifications', () => {
  it('preserves historical bill version PDF rendering when the parent template is modified', async () => {
    // 1. Create a bill template
    const tmplRes = await request(app)
      .post('/api/bill-templates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Immutable Test Template',
        template_type: 'CONSOLIDATED',
        layout_json: { primary_color: '#000000' },
        components: [
          {
            component_type: 'HEADER',
            component_key: 'hdr',
            position_x: 20,
            position_y: 20,
            width: 555,
            height: 50,
            content_json: { text: 'ORIGINAL TEMPLATE HEADER' }
          }
        ]
      });

    expect(tmplRes.status).toBe(201);
    templateId = tmplRes.body.data.id;

    // 2. Generate a bill using this template
    const billRes = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        party_id: partyId,
        billing_mode: 'CONSOLIDATED',
        financial_year_id: fyId,
        numbering_series_id: numberingSeriesId,
        bill_date: '2026-10-15',
        template_id: templateId,
        template_snapshot: {
          template: { name: 'Immutable Test Template' },
          components: [
            {
              component_type: 'HEADER',
              component_key: 'hdr',
              position_x: 20,
              position_y: 20,
              width: 555,
              height: 50,
              content_json: { text: 'ORIGINAL TEMPLATE HEADER' }
            }
          ]
        },
        trip_ids: [tripId]
      });

    expect(billRes.status).toBe(201);
    billId = billRes.body.data.bill.id;

    // 3. Request PDF for Version 1
    const pdfRes1 = await request(app)
      .get(`/api/bills/${billId}/pdf?version=1`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(pdfRes1.status).toBe(200);
    const pdfBytes1 = pdfRes1.body;

    // 4. Modify the template in bill_templates
    const updateRes = await request(app)
      .patch(`/api/bill-templates/${templateId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Mutated Template Name',
        components: [
          {
            component_type: 'HEADER',
            component_key: 'hdr',
            position_x: 20,
            position_y: 20,
            width: 555,
            height: 50,
            content_json: { text: 'MUTATED HEADER TEXT 2027' }
          }
        ]
      });

    expect(updateRes.status).toBe(200);

    // 5. Request PDF for Version 1 again
    const pdfRes2 = await request(app)
      .get(`/api/bills/${billId}/pdf?version=1`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(pdfRes2.status).toBe(200);
    const pdfBytes2 = pdfRes2.body;

    // 6. Verify that Version 1 PDF is preserved and unchanged
    expect(pdfBytes1.length).toBe(pdfBytes2.length);
    // The rendered version 1 PDF should contain ORIGINAL TEMPLATE HEADER, NOT MUTATED HEADER TEXT
    const pdf1Text = pdfBytes1.toString('utf-8');
    const pdf2Text = pdfBytes2.toString('utf-8');
    expect(pdf2Text).toContain('ORIGINAL TEMPLATE HEADER');
    expect(pdf2Text).not.toContain('MUTATED HEADER TEXT 2027');
  });

  describe('Phase 4K-C Remediation - Indian Numbering System Currency-to-Words Converter', () => {
    it('handles zero, null, undefined, empty, and invalid inputs deterministically', () => {
      expect(amountToWordsINR(0)).toBe('Zero Rupees Only');
      expect(amountToWordsINR('0')).toBe('Zero Rupees Only');
      expect(amountToWordsINR(null)).toBe('Zero Rupees Only');
      expect(amountToWordsINR(undefined)).toBe('Zero Rupees Only');
      expect(amountToWordsINR('')).toBe('Zero Rupees Only');
      expect(amountToWordsINR('invalid')).toBe('Zero Rupees Only');
    });

    it('handles singular rupee and paise fractions with explicit rounding', () => {
      expect(amountToWordsINR(1)).toBe('One Rupee Only');
      expect(amountToWordsINR(0.5)).toBe('Fifty Paise Only');
      expect(amountToWordsINR(0.05)).toBe('Five Paise Only');
      expect(amountToWordsINR(0.75)).toBe('Seventy Five Paise Only');
      expect(amountToWordsINR(1.01)).toBe('One Rupee and One Paise Only');
      // Rounding check: 100.555 rounds to 100.56
      expect(amountToWordsINR(100.555)).toBe('One Hundred Rupees and Fifty Six Paise Only');
    });

    it('handles negative currency values with Minus prefix', () => {
      expect(amountToWordsINR(-500)).toBe('Minus Five Hundred Rupees Only');
      expect(amountToWordsINR(-1500.5)).toBe('Minus One Thousand Five Hundred Rupees and Fifty Paise Only');
    });

    it('handles thousands, lakhs, and crores accurately according to the Indian numbering system', () => {
      expect(amountToWordsINR(100)).toBe('One Hundred Rupees Only');
      expect(amountToWordsINR(105)).toBe('One Hundred Five Rupees Only');
      expect(amountToWordsINR(1250)).toBe('One Thousand Two Hundred Fifty Rupees Only');
      expect(amountToWordsINR(12345)).toBe('Twelve Thousand Three Hundred Forty Five Rupees Only');
      expect(amountToWordsINR(100000)).toBe('One Lakh Rupees Only');
      expect(amountToWordsINR(125000)).toBe('One Lakh Twenty Five Thousand Rupees Only');
      expect(amountToWordsINR(125000.5)).toBe('One Lakh Twenty Five Thousand Rupees and Fifty Paise Only');
      expect(amountToWordsINR(2500000)).toBe('Twenty Five Lakh Rupees Only');
      expect(amountToWordsINR(10000000)).toBe('One Crore Rupees Only');
      expect(amountToWordsINR(123456789.25)).toBe(
        'Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Rupees and Twenty Five Paise Only'
      );
    });

    it('handles boundary values cleanly (99, 100, 999, 1000, 99999, 100000, 9999999, 10000000)', () => {
      expect(amountToWordsINR(99)).toBe('Ninety Nine Rupees Only');
      expect(amountToWordsINR(100)).toBe('One Hundred Rupees Only');
      expect(amountToWordsINR(999)).toBe('Nine Hundred Ninety Nine Rupees Only');
      expect(amountToWordsINR(1000)).toBe('One Thousand Rupees Only');
      expect(amountToWordsINR(99999)).toBe('Ninety Nine Thousand Nine Hundred Ninety Nine Rupees Only');
      expect(amountToWordsINR(100000)).toBe('One Lakh Rupees Only');
      expect(amountToWordsINR(9999999)).toBe('Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine Rupees Only');
      expect(amountToWordsINR(10000000)).toBe('One Crore Rupees Only');
    });

    it('resolves calculated.amount_in_words dynamically without being empty', () => {
      const context = {
        billing: { total_amount: 142500 },
        calculated: { total_amount: 142500 }
      };
      const result = resolveFieldValue('calculated.amount_in_words', context);
      expect(result).toBe('One Lakh Forty Two Thousand Five Hundred Rupees Only');

      // Pre-calculated override preserves manual string if provided
      const overrideContext = {
        calculated: { amount_in_words: 'Custom One Lakh Only' }
      };
      expect(resolveFieldValue('calculated.amount_in_words', overrideContext)).toBe('Custom One Lakh Only');
    });
  });

  describe('Phase 4K-C Remediation - Destination Unloading Charge Resolution', () => {
    it('resolves destination unloading charges in row context for multiple destinations with distinct charges', () => {
      const dest1 = {
        id: 'dest-001',
        from_location: 'Mundra Port',
        to_location: 'Jaipur Depot',
        unloading_charge: 1500
      };
      const dest2 = {
        id: 'dest-002',
        from_location: 'Jaipur Depot',
        to_location: 'Delhi Hub',
        unloading_charge: 2500
      };

      const context = {
        destinations: [dest1, dest2]
      };

      const charge1 = resolveFieldValue('journey.unloading_charge', context, dest1);
      const charge2 = resolveFieldValue('journey.unloading_charge', context, dest2);

      expect(charge1).toBe('INR 1,500.00');
      expect(charge2).toBe('INR 2,500.00');
    });

    it('strictly distinguishes party-side and vehicle-owner-side destination charges', () => {
      const multiSideDest = {
        id: 'dest-003',
        from_location: 'Kandla',
        to_location: 'Ahmedabad',
        unloading_charges: [
          { side: 'PARTY', amount: 1800 },
          { side: 'VEHICLE_OWNER', amount: 1400 }
        ]
      };

      // Party context (default for customer bills)
      const partyContext = {
        party: { name: 'Acme Logistics' },
        side: 'PARTY' as const
      };
      const partyCharge = resolveFieldValue('journey.unloading_charge', partyContext, multiSideDest);
      expect(partyCharge).toBe('INR 1,800.00');

      // Vehicle owner context
      const ownerContext = {
        vehicle_owner: { name: 'Owner Transport' },
        side: 'VEHICLE_OWNER' as const
      };
      const ownerCharge = resolveFieldValue('journey.unloading_charge', ownerContext, multiSideDest);
      expect(ownerCharge).toBe('INR 1,400.00');
    });

    it('resolves destination charges in consolidated bill repeated rows', () => {
      const repeatedItems = [
        {
          trip_number: 'TRP-101',
          id: 'dest-101',
          destination: 'Jaipur',
          unloading_charge: 1200
        },
        {
          trip_number: 'TRP-102',
          id: 'dest-102',
          destination: 'Kota',
          unloading_charge: 1600
        }
      ];

      const context = {
        items: repeatedItems
      };

      expect(resolveFieldValue('journey.unloading_charge', context, repeatedItems[0])).toBe('INR 1,200.00');
      expect(resolveFieldValue('journey.unloading_charge', context, repeatedItems[1])).toBe('INR 1,600.00');
    });
  });

  describe('Phase 4K-C Remediation - Historical Asset Retention and Required Asset Checks', () => {
    it('throws error when a required template asset is missing from snapshot (preventing silent omission)', () => {
      const incompleteBillData = {
        id: 'bill-req-asset-test',
        bill_number: 'SRL/26-27/REQ-01',
        bill_date: '2026-04-15',
        bill_status: 'GENERATED',
        billing_mode: 'INDIVIDUAL',
        total_amount: 50000,
        template_snapshot: {
          layout: {},
          components: [
            {
              component_type: 'IMAGE',
              component_key: 'logo',
              position_x: 20,
              position_y: 20,
              content_json: {
                label: 'SRL Official Logo',
                required: true,
                storage_key: 'templates/assets/missing_logo.png'
              }
            }
          ],
          assets: [] // Intentionally missing assets
        },
        items: [
          {
            sequence_no: 1,
            description: 'Freight Item',
            line_amount: 50000
          }
        ]
      };

      expect(() => {
        generateBillPdfBuffer(incompleteBillData as any);
      }).toThrow(/Required bill template asset "SRL Official Logo" \(IMAGE\) is missing from template snapshot/);
    });

    it('renders successfully when required asset is present in snapshot assets', () => {
      const validBillData = {
        id: 'bill-req-asset-valid',
        bill_number: 'SRL/26-27/REQ-02',
        bill_date: '2026-04-15',
        bill_status: 'GENERATED',
        billing_mode: 'INDIVIDUAL',
        total_amount: 50000,
        template_snapshot: {
          layout: {},
          components: [
            {
              component_type: 'IMAGE',
              component_key: 'logo',
              position_x: 20,
              position_y: 20,
              content_json: {
                label: 'SRL Official Logo',
                required: true,
                storage_key: 'templates/assets/valid_logo.png'
              }
            }
          ],
          assets: [
            {
              asset_type: 'IMAGE',
              file_name: 'valid_logo.png',
              storage_key: 'templates/assets/valid_logo.png'
            }
          ]
        },
        items: [
          {
            sequence_no: 1,
            description: 'Freight Item',
            line_amount: 50000
          }
        ]
      };

      const pdfBuf = generateBillPdfBuffer(validBillData as any);
      expect(pdfBuf).toBeInstanceOf(Buffer);
      expect(pdfBuf.length).toBeGreaterThan(500);
    });
  });

  describe('Phase 4K-D — PAGE_BREAK Semantics & Multi-Page Template Architecture', () => {
    it('handles static page break between text blocks, emitting exactly 2 pages with correct page numbering', () => {
      const pdfData: any = {
        bill_number: 'SRL/26-27/PB-001',
        bill_date: '2026-10-15',
        bill_status: 'GENERATED',
        billing_mode: 'INDIVIDUAL',
        total_amount: 50000,
        paid_amount: 0,
        balance_amount: 50000,
        party: { name: 'Adani Logistics Ltd' },
        template_snapshot: {
          layout: { page_width: 595.28, page_height: 841.89, margin_top: 40, margin_bottom: 40 },
          components: [
            {
              component_type: 'TEXT',
              component_key: 'page1_text',
              position_x: 40,
              position_y: 60,
              content_json: { text: 'CONTENT ON PAGE ONE OF TRANSPORT ADVICE' }
            },
            {
              component_type: 'PAGE_BREAK',
              component_key: 'pb_1',
              position_x: 40,
              position_y: 300
            },
            {
              component_type: 'TEXT',
              component_key: 'page2_text',
              position_x: 40,
              position_y: 60,
              content_json: { text: 'CONTENT ON PAGE TWO - TERMS AND SIGNATURES' }
            }
          ]
        },
        items: []
      };

      const pdfBuffer = generateBillPdfBuffer(pdfData);
      const pdfString = pdfBuffer.toString('utf-8');

      // Verify exactly 2 pages emitted
      const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
      expect(pageMatches).not.toBeNull();
      expect(pageMatches!.length).toBe(2);

      // Verify content and page numbers
      expect(pdfString).toContain('CONTENT ON PAGE ONE OF TRANSPORT ADVICE');
      expect(pdfString).toContain('CONTENT ON PAGE TWO - TERMS AND SIGNATURES');
      expect(pdfString).toContain('Page 1 of 2');
      expect(pdfString).toContain('Page 2 of 2');
    });

    it('handles page breaks between different component types (Header + Text on Page 1, Table on Page 2)', () => {
      const items = [
        { sequence_no: 1, trip_number: 'TRP-PB-01', vehicle_number: 'RJ14GB1001', description: 'Freight Mundra', line_amount: 45000 },
        { sequence_no: 2, trip_number: 'TRP-PB-02', vehicle_number: 'RJ14GB1002', description: 'Freight Kandla', line_amount: 55000 }
      ];

      const pdfData: any = {
        bill_number: 'SRL/26-27/PB-002',
        bill_date: '2026-10-15',
        bill_status: 'GENERATED',
        billing_mode: 'CONSOLIDATED',
        total_amount: 100000,
        paid_amount: 25000,
        balance_amount: 75000,
        party: { name: 'Adani Logistics Ltd' },
        template_snapshot: {
          layout: { page_width: 595.28, page_height: 841.89, margin_top: 40, margin_bottom: 40 },
          components: [
            {
              component_type: 'HEADER',
              component_key: 'hdr_p1',
              position_x: 40,
              position_y: 20,
              content_json: { title: 'SHRI SANWARIYA ROAD LINES', subtitle: 'Consolidated Billing Statement' }
            },
            {
              component_type: 'TEXT',
              component_key: 'cover_p1',
              position_x: 40,
              position_y: 80,
              content_json: { text: 'Attention: Accounts Department. Please find statement attached.' }
            },
            {
              component_type: 'PAGE_BREAK',
              component_key: 'pb_sep',
              position_x: 40,
              position_y: 200
            },
            {
              component_type: 'TABLE',
              component_key: 'tbl_p2',
              position_x: 40,
              position_y: 20,
              content_json: {}
            }
          ]
        },
        items
      };

      const pdfBuffer = generateBillPdfBuffer(pdfData);
      const pdfString = pdfBuffer.toString('utf-8');

      // Verify 2 pages
      const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
      expect(pageMatches).not.toBeNull();
      expect(pageMatches!.length).toBe(2);

      // Cover text on page 1, Table continuation header on page 2
      expect(pdfString).toContain('Consolidated Billing Statement');
      expect(pdfString).toContain('Attention: Accounts Department');
      expect(pdfString).toContain('TRP-PB-01');
      expect(pdfString).toContain('TRP-PB-02');
      expect(pdfString).toContain('Page 1 of 2');
      expect(pdfString).toContain('Page 2 of 2');
      expect(pdfString).toContain('Continuation');
    });

    it('handles page break after repeatable table to separate terms/signatures onto terminal page', () => {
      const items = [
        { sequence_no: 1, trip_number: 'TRP-PB-10', vehicle_number: 'RJ14GB5555', description: 'Freight Jodhpur', line_amount: 60000 }
      ];

      const pdfData: any = {
        bill_number: 'SRL/26-27/PB-003',
        bill_date: '2026-10-15',
        bill_status: 'GENERATED',
        billing_mode: 'INDIVIDUAL',
        total_amount: 60000,
        paid_amount: 0,
        balance_amount: 60000,
        party: { name: 'Adani Logistics Ltd' },
        template_snapshot: {
          layout: { page_width: 595.28, page_height: 841.89, margin_top: 40, margin_bottom: 40 },
          components: [
            {
              component_type: 'HEADER',
              component_key: 'hdr',
              position_x: 40,
              position_y: 20,
              content_json: { title: 'SHRI SANWARIYA ROAD LINES' }
            },
            {
              component_type: 'TABLE',
              component_key: 'tbl',
              position_x: 40,
              position_y: 80,
              content_json: {}
            },
            {
              component_type: 'PAGE_BREAK',
              component_key: 'pb_after_tbl',
              position_x: 40,
              position_y: 450
            },
            {
              component_type: 'TEXT',
              component_key: 'terms',
              position_x: 40,
              position_y: 40,
              content_json: { text: 'DECLARATION: We declare that this invoice shows the actual price of services described.' }
            },
            {
              component_type: 'FOOTER',
              component_key: 'foot',
              position_x: 40,
              position_y: 780,
              content_json: { text: 'For Shri Sanwariya Road Lines - Authorized Signatory' }
            }
          ]
        },
        items
      };

      const pdfBuffer = generateBillPdfBuffer(pdfData);
      const pdfString = pdfBuffer.toString('utf-8');

      // Verify exactly 2 pages
      const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
      expect(pageMatches).not.toBeNull();
      expect(pageMatches!.length).toBe(2);

      expect(pdfString).toContain('TRP-PB-10');
      expect(pdfString).toContain('DECLARATION');
      expect(pdfString).toContain('Authorized Signatory');
      expect(pdfString).toContain('Page 1 of 2');
      expect(pdfString).toContain('Page 2 of 2');
      expect(pdfString).toContain('Total Amount:   INR 60,000.00');
    });

    it('avoids blank pages on consecutive and boundary page breaks (leading, trailing, duplicate breaks)', () => {
      const pdfData: any = {
        bill_number: 'SRL/26-27/PB-004',
        bill_date: '2026-10-15',
        bill_status: 'GENERATED',
        billing_mode: 'INDIVIDUAL',
        total_amount: 30000,
        paid_amount: 0,
        balance_amount: 30000,
        party: { name: 'Adani Logistics Ltd' },
        template_snapshot: {
          layout: { page_width: 595.28, page_height: 841.89, margin_top: 40, margin_bottom: 40 },
          components: [
            // Leading break - must NOT create blank page 1
            { component_type: 'PAGE_BREAK', component_key: 'pb_lead', position_y: 10 },
            {
              component_type: 'TEXT',
              component_key: 't1',
              position_x: 40,
              position_y: 50,
              content_json: { text: 'PRIMARY SECTION CONTENT' }
            },
            // Consecutive duplicate breaks - must collapse to single page break
            { component_type: 'PAGE_BREAK', component_key: 'pb_mid1', position_y: 200 },
            { component_type: 'PAGE_BREAK', component_key: 'pb_mid2', position_y: 220 },
            { component_type: 'PAGE_BREAK', component_key: 'pb_mid3', position_y: 240 },
            {
              component_type: 'TEXT',
              component_key: 't2',
              position_x: 40,
              position_y: 50,
              content_json: { text: 'SECONDARY SECTION CONTENT' }
            },
            // Trailing break - must NOT create blank trailing page
            { component_type: 'PAGE_BREAK', component_key: 'pb_trail', position_y: 500 }
          ]
        },
        items: []
      };

      const pdfBuffer = generateBillPdfBuffer(pdfData);
      const pdfString = pdfBuffer.toString('utf-8');

      // Verify exactly 2 pages emitted (not 4 or 5)
      const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
      expect(pageMatches).not.toBeNull();
      expect(pageMatches!.length).toBe(2);

      expect(pdfString).toContain('PRIMARY SECTION CONTENT');
      expect(pdfString).toContain('SECONDARY SECTION CONTENT');
      expect(pdfString).toContain('Page 1 of 2');
      expect(pdfString).toContain('Page 2 of 2');
    });

    it('handles complex interaction: multi-page table auto-overflow with page breaks and terminal totals', () => {
      // 35 items: exceeds 22 items per page, so table alone takes 2 pages!
      const items = [];
      for (let i = 1; i <= 35; i++) {
        items.push({
          sequence_no: i,
          trip_number: `TRP-OVF-${String(i).padStart(3, '0')}`,
          vehicle_number: `GJ12AB${2000 + i}`,
          description: `Consignment Mundra to Destination ${i}`,
          line_amount: 40000 + i * 500
        });
      }

      const pdfData: any = {
        bill_number: 'SRL/26-27/PB-005',
        bill_date: '2026-10-15',
        bill_status: 'GENERATED',
        billing_mode: 'CONSOLIDATED',
        total_amount: 1715000,
        paid_amount: 0,
        balance_amount: 1715000,
        party: { name: 'Adani Logistics Ltd' },
        template_snapshot: {
          layout: { page_width: 595.28, page_height: 841.89, margin_top: 40, margin_bottom: 40 },
          components: [
            // Section 1: Cover details (Page 1)
            {
              component_type: 'HEADER',
              component_key: 'cov_hdr',
              position_x: 40,
              position_y: 20,
              content_json: { title: 'SHRI SANWARIYA ROAD LINES', subtitle: 'Consolidated Billing Summary' }
            },
            {
              component_type: 'TEXT',
              component_key: 'cov_txt',
              position_x: 40,
              position_y: 70,
              content_json: { text: 'COVER NOTE: Summary of 35 freight operations executed in October 2026.' }
            },
            // Page Break before Table
            { component_type: 'PAGE_BREAK', component_key: 'pb_before_tbl', position_y: 200 },
            // Section 2: Table (takes 2 pages: Page 2 items 1..22, Page 3 items 23..35)
            {
              component_type: 'TABLE',
              component_key: 'tbl',
              position_x: 40,
              position_y: 30,
              content_json: {}
            },
            // Page Break after Table
            { component_type: 'PAGE_BREAK', component_key: 'pb_after_tbl', position_y: 700 },
            // Section 3: Annexure and Legal Declarations (Page 4)
            {
              component_type: 'HEADER',
              component_key: 'annex_hdr',
              position_x: 40,
              position_y: 20,
              content_json: { title: 'ANNEXURE I - STATUTORY UNDERTAKING' }
            },
            {
              component_type: 'TEXT',
              component_key: 'annex_txt',
              position_x: 40,
              position_y: 70,
              content_json: { text: 'We hereby certify that Goods Transport Agency services were provided as per agreed tariff.' }
            },
            {
              component_type: 'FOOTER',
              component_key: 'annex_foot',
              position_x: 40,
              position_y: 780,
              content_json: { text: 'Authorized Signatory - Shri Sanwariya Road Lines' }
            }
          ]
        },
        items
      };

      const pdfBuffer = generateBillPdfBuffer(pdfData);
      const pdfString = pdfBuffer.toString('utf-8');

      // Total Pages should be exactly 4 (Page 1: Cover, Page 2: Table P1, Page 3: Table P2, Page 4: Annexure)
      const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
      expect(pageMatches).not.toBeNull();
      expect(pageMatches!.length).toBe(4);

      // Verify all page labels exist
      expect(pdfString).toContain('Page 1 of 4');
      expect(pdfString).toContain('Page 2 of 4');
      expect(pdfString).toContain('Page 3 of 4');
      expect(pdfString).toContain('Page 4 of 4');

      // Verify continuation headers appear on continuation table pages
      expect(pdfString).toContain('Continuation');

      // Verify all 35 trips are rendered without omission
      expect(pdfString).toContain('TRP-OVF-001');
      expect(pdfString).toContain('TRP-OVF-022');
      expect(pdfString).toContain('TRP-OVF-023');
      expect(pdfString).toContain('TRP-OVF-035');

      // Verify cover text and annexure text
      expect(pdfString).toContain('Summary of 35 freight operations');
      expect(pdfString).toContain('ANNEXURE I - STATUTORY UNDERTAKING');

      // Verify authoritative totals block is rendered on the terminal page
      expect(pdfString).toContain('Total Amount:   INR 17,15,000.00');
    });

    it('previews draft template with PAGE_BREAK via /api/bill-templates/preview endpoint without mutation', async () => {
      const initialCount = (await pool.query('SELECT COUNT(*)::int as c FROM bill_templates')).rows[0].c;

      const res = await request(app)
        .post('/api/bill-templates/preview')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          template_type: 'MULTI_PAGE',
          layout_json: { page_width: 595.28, page_height: 841.89 },
          components: [
            {
              component_type: 'HEADER',
              component_key: 'h1',
              position_x: 40,
              position_y: 20,
              content_json: { text: 'PREVIEW PAGE 1' }
            },
            {
              component_type: 'PAGE_BREAK',
              component_key: 'pb_prev',
              position_x: 40,
              position_y: 200
            },
            {
              component_type: 'HEADER',
              component_key: 'h2',
              position_x: 40,
              position_y: 20,
              content_json: { text: 'PREVIEW PAGE 2' }
            }
          ],
          format: 'pdf'
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');

      const pdfString = Buffer.from(res.body).toString('utf-8');
      const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
      expect(pageMatches).not.toBeNull();
      expect(pageMatches!.length).toBe(2);
      expect(pdfString).toContain('PREVIEW PAGE 1');
      expect(pdfString).toContain('PREVIEW PAGE 2');
      expect(pdfString).toContain('Page 1 of 2');
      expect(pdfString).toContain('Page 2 of 2');

      // Verify zero DB mutations
      const finalCount = (await pool.query('SELECT COUNT(*)::int as c FROM bill_templates')).rows[0].c;
      expect(finalCount).toBe(initialCount);
    });
  });
});
