import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';

let ownerToken: string;
let staffToken: string;
let caToken: string;
let ownerId: string;
let staffId: string;
let caId: string;

let fy26Id: string;
let fy27Id: string;
let partyId: string;
let templateId: string;
let mainSeriesId: string;
let expSeriesId: string;

let trip1Id: string;
let trip2Id: string;
let trip3Id: string;
let inTransitTripId: string;
let missingPodTripId: string;

beforeAll(async () => {
  await pool.query(
    'TRUNCATE users, parties, party_billing_configs, bill_templates, bill_template_components, bill_template_dynamic_fields, bill_template_assets, trips, trip_destinations, trip_pods, trip_party_financials, bills, bill_items, bill_versions, bill_version_items, bill_numbering_series, financial_years, market_vehicles, vehicle_owners, payments, payment_allocations, audit_events CASCADE'
  );

  const hash = await hashPassword('pass1234');
  ownerId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner User', 'OWNER', '9876543210', $1, true) RETURNING id",
      [hash]
    )
  ).rows[0].id;

  staffId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Staff User', 'STAFF', '9876543211', $1, true) RETURNING id",
      [hash]
    )
  ).rows[0].id;

  caId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('CA Auditor', 'CA', '9876543212', $1, true) RETURNING id",
      [hash]
    )
  ).rows[0].id;

  const jwt = require('jsonwebtoken');
  const secret = require('../src/config').config.jwt.secret;
  ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, secret, { expiresIn: '1d' });
  staffToken = jwt.sign({ id: staffId, role: 'STAFF' }, secret, { expiresIn: '1d' });
  caToken = jwt.sign({ id: caId, role: 'CA' }, secret, { expiresIn: '1d' });

  // Financial Years
  fy26Id = (
    await pool.query(
      "INSERT INTO financial_years (code, start_date, end_date, is_active) VALUES ('FY26', '2026-04-01', '2027-03-31', true) RETURNING id"
    )
  ).rows[0].id;

  fy27Id = (
    await pool.query(
      "INSERT INTO financial_years (code, start_date, end_date, is_active) VALUES ('FY27', '2027-04-01', '2028-03-31', false) RETURNING id"
    )
  ).rows[0].id;

  // Party
  partyId = (
    await pool.query(
      `INSERT INTO parties (name, primary_mobile, party_type, gstin, full_address, city, state, pin_code, is_active) 
       VALUES ('Universal Logistics Corp', '9820011223', 'COMPANY', '27AABCU9603R1ZM', 'Plot 45, MIDC Industrial Area', 'Pune', 'Maharashtra', '411018', true) 
       RETURNING id`
    )
  ).rows[0].id;

  // Vehicle & Owner
  const voId = (
    await pool.query("INSERT INTO vehicle_owners (name, mobile_number) VALUES ('Kailash Transport', '9890123456') RETURNING id")
  ).rows[0].id;

  const mvId = (
    await pool.query(
      "INSERT INTO market_vehicles (vehicle_number, vehicle_owner_id, is_active) VALUES ('MH14AB9999', $1, true) RETURNING id",
      [voId]
    )
  ).rows[0].id;

  // Trips
  // Trip 1: Completed, POD received, freight 45000
  trip1Id = (
    await pool.query(
      `INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) 
       VALUES ('E2E-TRP-01', $1, 'MARKET', 'MARKET', $2, 'Pune', 'Ahmedabad', 'COMPLETED', '2026-10-01', $3) RETURNING id`,
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;
  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [trip1Id]);
  await pool.query(
    'INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 45000)',
    [trip1Id]
  );

  // Trip 2: Completed, POD received, freight 35000
  trip2Id = (
    await pool.query(
      `INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) 
       VALUES ('E2E-TRP-02', $1, 'MARKET', 'MARKET', $2, 'Ahmedabad', 'Surat', 'COMPLETED', '2026-10-02', $3) RETURNING id`,
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;
  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [trip2Id]);
  await pool.query(
    'INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 35000)',
    [trip2Id]
  );

  // Trip 3: Completed, POD received, freight 25000
  trip3Id = (
    await pool.query(
      `INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) 
       VALUES ('E2E-TRP-03', $1, 'MARKET', 'MARKET', $2, 'Surat', 'Mumbai', 'COMPLETED', '2026-10-03', $3) RETURNING id`,
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;
  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [trip3Id]);
  await pool.query(
    'INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 25000)',
    [trip3Id]
  );

  // Trip 4: In-Transit (Ineligible)
  inTransitTripId = (
    await pool.query(
      `INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) 
       VALUES ('E2E-TRP-INTRANSIT', $1, 'MARKET', 'MARKET', $2, 'Mumbai', 'Goa', 'IN_TRANSIT', '2026-10-04', $3) RETURNING id`,
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;

  // Trip 5: Completed but Missing POD (Ineligible)
  missingPodTripId = (
    await pool.query(
      `INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) 
       VALUES ('E2E-TRP-NOPOD', $1, 'MARKET', 'MARKET', $2, 'Goa', 'Pune', 'COMPLETED', '2026-10-05', $3) RETURNING id`,
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;
  await pool.query("INSERT INTO trip_pods (trip_id, pod_status) VALUES ($1, 'PENDING')", [missingPodTripId]);
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 4L — Comprehensive End-to-End Billing Workflow & Integration Audit', () => {
  describe('A. Party Billing Configuration & Numbering Series Lifecycle', () => {
    it('enforces RBAC: Staff and CA cannot modify party billing configuration (403)', async () => {
      const staffRes = await request(app)
        .patch(`/api/parties/${partyId}/billing-config`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({ billing_mode: 'CONSOLIDATED' });
      expect(staffRes.status).toBe(403);

      const caRes = await request(app)
        .patch(`/api/parties/${partyId}/billing-config`)
        .set('Authorization', 'Bearer ' + caToken)
        .send({ billing_mode: 'CONSOLIDATED' });
      expect(caRes.status).toBe(403);
    });

    it('allows Owner to configure party billing configuration and locks billing mode to CONSOLIDATED', async () => {
      const res = await request(app)
        .patch(`/api/parties/${partyId}/billing-config`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({
          billing_mode: 'CONSOLIDATED',
          tds_treatment: 'TDS_194C',
          required_fields: { po_number: true, pod_signed: true }
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.billing_configuration.billing_mode).toBe('CONSOLIDATED');
      expect(res.body.data.billing_configuration.tds_treatment).toBe('TDS_194C');
    });

    it('enforces RBAC on Numbering Series: Staff and CA cannot create or update numbering series (403)', async () => {
      const staffRes = await request(app)
        .post('/api/numbering-series')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          series_code: 'TEST',
          prefix: 'SRL/26-27/'
        });
      expect(staffRes.status).toBe(403);

      const caRes = await request(app)
        .post('/api/numbering-series')
        .set('Authorization', 'Bearer ' + caToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          series_code: 'TEST',
          prefix: 'SRL/26-27/'
        });
      expect(caRes.status).toBe(403);
    });

    it('allows Owner to create multiple numbering series for the same party and financial year', async () => {
      // Main series
      const mainRes = await request(app)
        .post('/api/numbering-series')
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          series_code: 'MAIN',
          prefix: 'SRL/26-27/'
        });
      expect(mainRes.status).toBe(201);
      expect(mainRes.body.data.prefix).toBe('SRL/26-27/');
      expect(mainRes.body.data.current_number).toBe(0);
      mainSeriesId = mainRes.body.data.id;

      // Express series
      const expRes = await request(app)
        .post('/api/numbering-series')
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          series_code: 'EXP',
          prefix: 'SRL/26-27/EXP-'
        });
      expect(expRes.status).toBe(201);
      expect(expRes.body.data.prefix).toBe('SRL/26-27/EXP-');
      expSeriesId = expRes.body.data.id;

      // Reject duplicate series code for same party and FY
      const dupRes = await request(app)
        .post('/api/numbering-series')
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          series_code: 'MAIN',
          prefix: 'SRL/26-27/OTHER-'
        });
      expect(dupRes.status).toBe(409);
    });

    it('allows editing prefix before bills are generated, but rejects deactivation by non-Owner', async () => {
      // Owner updates prefix before any bills are generated
      const updateRes = await request(app)
        .patch(`/api/numbering-series/${mainSeriesId}`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ prefix: 'SRL/26-27/INV-' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.prefix).toBe('SRL/26-27/INV-');

      // Staff cannot deactivate
      const staffDeact = await request(app)
        .post(`/api/numbering-series/${expSeriesId}/deactivate`)
        .set('Authorization', 'Bearer ' + staffToken);
      expect(staffDeact.status).toBe(403);
    });
  });

  describe('B. Bill Designer Lifecycle, Assets & Non-Mutating Preview', () => {
    it('creates a structured bill template with repeatable table, dynamic fields, and PAGE_BREAK', async () => {
      const templatePayload = {
        name: 'SSRL Master Logistics Template',
        template_type: 'CONSOLIDATED',
        layout_json: {
          pageSize: 'A4',
          orientation: 'portrait',
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          headerHeight: 40,
          footerHeight: 30
        },
        components: [
          {
            component_type: 'HEADER',
            component_key: 'company_header',
            position_x: 20,
            position_y: 20,
            width: 555,
            height: 40,
            content_json: { title: 'SHRI SANWARIYA ROAD LINES', subtitle: 'Tax Invoice / Freight Bill' }
          },
          {
            component_type: 'TEXT',
            component_key: 'bill_info',
            position_x: 20,
            position_y: 70,
            width: 270,
            height: 40,
            content_json: { text: 'Bill No: {{billing.bill_number}}\nDate: {{billing.bill_date}}' }
          },
          {
            component_type: 'TEXT',
            component_key: 'party_info',
            position_x: 300,
            position_y: 70,
            width: 275,
            height: 40,
            content_json: { text: 'Billed To: {{party.name}}\nGSTIN: {{party.gstin}}' }
          },
          {
            component_type: 'TABLE',
            component_key: 'trip_table',
            position_x: 20,
            position_y: 120,
            width: 555,
            height: 200,
            content_json: {
              columns: [
                { title: 'Sr No', field: 'sequence_no', width: 40 },
                { title: 'Trip Number', field: 'trip_number', width: 100 },
                { title: 'Vehicle No', field: 'vehicle_number', width: 95 },
                { title: 'Route', field: 'route', width: 180 },
                { title: 'Amount', field: 'line_amount', width: 140, align: 'right' }
              ]
            }
          },
          {
            component_type: 'PAGE_BREAK',
            component_key: 'break_before_terms',
            position_x: 20,
            position_y: 330,
            width: 555,
            height: 10,
            content_json: {}
          },
          {
            component_type: 'TEXT',
            component_key: 'totals_and_words',
            position_x: 20,
            position_y: 350,
            width: 555,
            height: 50,
            content_json: { text: 'Total Amount: {{calculated.total_freight}}\nAmount in Words: {{calculated.amount_in_words}}' }
          }
        ]
      };

      const res = await request(app)
        .post('/api/bill-templates')
        .set('Authorization', 'Bearer ' + ownerToken)
        .send(templatePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('SSRL Master Logistics Template');
      templateId = res.body.data.id;
    });

    it('previews template without mutating database records or creating persistent bills', async () => {
      const previewPayload = {
        template_id: templateId,
        party_id: partyId,
        mock_data: {
          bill: { bill_number: 'PREVIEW-001', bill_date: '2026-10-14' },
          party: { name: 'Universal Logistics Corp', gstin: '27AABCU9603R1ZM' },
          items: [
            { sequence_no: 1, trip_number: 'TRP-01', vehicle_number: 'MH14AB9999', route: 'Pune to Ahmedabad', line_amount: 45000 }
          ],
          calculated: { total_freight: '45,000.00', amount_in_words: 'Forty Five Thousand Rupees Only' }
        }
      };

      const res = await request(app)
        .post('/api/bill-templates/preview')
        .set('Authorization', 'Bearer ' + staffToken)
        .send(previewPayload);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      const pdfStr = res.body.toString('latin1');
      expect(pdfStr.startsWith('%PDF-1.4')).toBe(true);

      // Verify no bills were persisted in database
      const billCount = await pool.query('SELECT COUNT(*)::int FROM bills');
      expect(billCount.rows[0].count).toBe(0);
    });

    it('supports reference document import returning editable reconstructed components', async () => {
      const importPayload = {
        file_name: 'reference_sample.pdf',
        file_content_base64: Buffer.from('%PDF-1.4\n%Reference sample bill text for import testing\nTrailer\n%%EOF').toString('base64'),
        mime_type: 'application/pdf'
      };

      const res = await request(app)
        .post('/api/bill-templates/import')
        .set('Authorization', 'Bearer ' + ownerToken)
        .send(importPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.components).toBeDefined();
      expect(Array.isArray(res.body.data.components)).toBe(true);
    });

    it('associates the template as the default template for the party', async () => {
      const res = await request(app)
        .patch(`/api/parties/${partyId}/billing-config`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({
          default_template_id: templateId
        });
      expect(res.status).toBe(200);
      expect(res.body.data.billing_configuration.default_template_id).toBe(templateId);
    });
  });

  describe('C. Individual and Consolidated Bill Generation Integrity', () => {
    it('verifies eligible trips returns only completed trips with received POD', async () => {
      const res = await request(app)
        .get(`/api/bills/eligible-trips?party_id=${partyId}`)
        .set('Authorization', 'Bearer ' + staffToken);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3); // Trip 1, 2, 3
      const tripNumbers = res.body.data.map((t: any) => t.trip_number);
      expect(tripNumbers).toContain('E2E-TRP-01');
      expect(tripNumbers).toContain('E2E-TRP-02');
      expect(tripNumbers).toContain('E2E-TRP-03');
      expect(tripNumbers).not.toContain('E2E-TRP-INTRANSIT');
      expect(tripNumbers).not.toContain('E2E-TRP-NOPOD');
    });

    it('rejects bill generation for ineligible trips (IN_TRANSIT or missing POD) with 422', async () => {
      const inTransitRes = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          numbering_series_id: mainSeriesId,
          billing_mode: 'CONSOLIDATED',
          bill_date: '2026-10-06',
          trip_ids: [inTransitTripId],
          template_snapshot: {}
        });
      expect(inTransitRes.status).toBe(422);
      expect(inTransitRes.body.error.message).toContain('not in COMPLETED status');

      const noPodRes = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          numbering_series_id: mainSeriesId,
          billing_mode: 'CONSOLIDATED',
          bill_date: '2026-10-06',
          trip_ids: [missingPodTripId],
          template_snapshot: {}
        });
      expect(noPodRes.status).toBe(422);
      expect(noPodRes.body.error.message).toContain('does not have a received POD');
    });

    it('rejects bill generation when billing_mode does not match company configured mode (422)', async () => {
      // Party is configured for CONSOLIDATED mode; sending INDIVIDUAL must be rejected
      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          numbering_series_id: mainSeriesId,
          billing_mode: 'INDIVIDUAL',
          bill_date: '2026-10-06',
          trip_ids: [trip1Id],
          template_snapshot: {}
        });
      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('does not match company configured billing mode');
    });

    it('rejects bill generation if numbering series belongs to a different party or financial year (404/422)', async () => {
      // Create another party
      const otherPartyId = (
        await pool.query(
          "INSERT INTO parties (name, primary_mobile, party_type, is_active) VALUES ('Other Party', '9991112233', 'MARKET_PARTY', true) RETURNING id"
        )
      ).rows[0].id;

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: otherPartyId,
          financial_year_id: fy26Id,
          numbering_series_id: mainSeriesId, // mainSeriesId belongs to partyId, not otherPartyId!
          billing_mode: 'CONSOLIDATED',
          bill_date: '2026-10-06',
          trip_ids: [trip1Id],
          template_snapshot: {}
        });
      expect([404, 422]).toContain(res.status);
    });

    let generatedBillId: string;
    let generatedBillNumber: string;

    it('generates a consolidated bill for trips 1 and 2 with authoritative totals and template snapshot capture', async () => {
      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          numbering_series_id: mainSeriesId,
          billing_mode: 'CONSOLIDATED',
          bill_date: '2026-10-06',
          trip_ids: [trip1Id, trip2Id],
          template_snapshot: {}
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const bill = res.body.data.bill;
      expect(bill.bill_number).toBe('SRL/26-27/INV-1');
      expect(bill.bill_status).toBe('GENERATED');
      expect(Number(bill.total_amount)).toBe(80000); // 45000 + 35000
      expect(Number(bill.balance_amount)).toBe(80000);
      expect(Number(bill.total_amount) - Number(bill.balance_amount)).toBe(0);

      generatedBillId = bill.id;
      generatedBillNumber = bill.bill_number;

      // Verify template snapshot was captured in bill_versions
      const versionRes = await pool.query('SELECT * FROM bill_versions WHERE bill_id = $1 AND version_number = 1', [generatedBillId]);
      expect(versionRes.rows.length).toBe(1);
      const ver = versionRes.rows[0];
      expect(ver.template_snapshot).toBeDefined();
      expect(ver.template_snapshot.components.length).toBeGreaterThan(0);
      expect(ver.resolved_dynamic_fields).toBeDefined();
    });

    it('enforces prefix immutability on numbering series once bills have been generated (422)', async () => {
      const updateAttempt = await request(app)
        .patch(`/api/numbering-series/${mainSeriesId}`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ prefix: 'MUTATED/PREFIX/' });

      expect(updateAttempt.status).toBe(422);
      expect(updateAttempt.body.error.message).toContain('Cannot alter prefix or series code');
    });

    it('protects historical PDF rendering against later source template modifications', async () => {
      // Modify source template in bill_templates
      await pool.query(
        "UPDATE bill_templates SET name = 'MODIFIED TEMPLATE NAME AFTER BILLING' WHERE id = $1",
        [templateId]
      );

      // Historical bill PDF generation must continue to succeed
      const pdfRes = await request(app)
        .get(`/api/bills/${generatedBillId}/pdf`)
        .set('Authorization', 'Bearer ' + caToken);

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toBe('application/pdf');
      const pdfStr = pdfRes.body.toString('latin1');
      expect(pdfStr.startsWith('%PDF-1.4')).toBe(true);
      expect(pdfStr).toContain('SHRI SANWARIYA ROAD LINES');
    });
  });

  describe('D. Bill Submission, Versioning, and Correction Integrity', () => {
    let billId: string;

    beforeAll(async () => {
      const res = await pool.query("SELECT id FROM bills WHERE bill_number = 'SRL/26-27/INV-1'");
      billId = res.rows[0].id;
    });

    it('submits a GENERATED bill, transitioning status to SUBMITTED', async () => {
      const res = await request(app)
        .post(`/api/bills/${billId}/submit`)
        .set('Authorization', 'Bearer ' + staffToken);

      expect(res.status).toBe(200);
      expect(res.body.data.bill_status).toBe('SUBMITTED');
    });

    it('creates Version 2 correction under the SAME bill number with adjusted line items', async () => {
      const v2Res = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          items: [
            { trip_id: trip1Id, sequence_no: 1, description: 'Adjusted freight Trip 1', line_amount: 50000 },
            { trip_id: trip2Id, sequence_no: 2, description: 'Adjusted freight Trip 2', line_amount: 40000 }
          ]
        });

      expect(v2Res.status).toBe(201);
      expect(v2Res.body.data.version_number).toBe(2);
      expect(v2Res.body.data.version_status).toBe('ACTIVE');

      const billDetail = await request(app).get(`/api/bills/${billId}`).set('Authorization', 'Bearer ' + ownerToken);
      expect(billDetail.body.data.bill_number).toBe('SRL/26-27/INV-1'); // Same bill number!
      expect(billDetail.body.data.current_version).toBe(2);
      expect(Number(billDetail.body.data.total_amount)).toBe(90000); // 50000 + 40000
      expect(Number(billDetail.body.data.balance_amount)).toBe(90000);
    });

    it('verifies Version 1 remains immutable and inspectable with original line items and total', async () => {
      const v1Res = await request(app)
        .get(`/api/bills/${billId}/versions/1`)
        .set('Authorization', 'Bearer ' + caToken);

      expect(v1Res.status).toBe(200);
      expect(v1Res.body.data.version_number).toBe(1);
      expect(v1Res.body.data.version_status).toBe('SUPERSEDED');
      expect(v1Res.body.data.items.length).toBe(2);
      expect(Number(v1Res.body.data.items[0].line_amount)).toBe(45000);
      expect(Number(v1Res.body.data.items[1].line_amount)).toBe(35000);
    });
  });

  describe('E. Payment Module Integration & Real-Time Status Reconciliation', () => {
    let billId: string;
    let paymentId: string;

    beforeAll(async () => {
      const res = await pool.query("SELECT id FROM bills WHERE bill_number = 'SRL/26-27/INV-1'");
      billId = res.rows[0].id;
    });

    it('partial payment allocation: reduces balance amount, bill status remains SUBMITTED (no PARTIALLY_PAID)', async () => {
      // Create partial payment of 50000 via Payment Module
      const payRes = await request(app)
        .post('/api/payments')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          payment_direction: 'INCOMING',
          payment_category: 'COMPANY_PAYMENT',
          party_id: partyId,
          payment_date: '2026-10-07',
          amount: 50000,
          payment_mode: 'BANK_TRANSFER',
          allocations: [
            { allocation_type: 'BILL', allocated_amount: 50000, target_bill_id: billId }
          ]
        });

      expect(payRes.status).toBe(201);
      paymentId = payRes.body.data.id;

      // Inspect bill status and balances
      const billRes = await request(app).get(`/api/bills/${billId}`).set('Authorization', 'Bearer ' + caToken);
      expect(billRes.body.data.bill_status).toBe('SUBMITTED');
      expect(Number(billRes.body.data.total_amount)).toBe(90000);
      expect(Number(billRes.body.data.paid_amount)).toBe(50000);
      expect(Number(billRes.body.data.balance_amount)).toBe(40000);
    });

    it('full payment allocation: bill status automatically transitions to PAID with paid_at set', async () => {
      // Create second payment of 40000 to clear remaining balance
      const pay2Res = await request(app)
        .post('/api/payments')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          payment_direction: 'INCOMING',
          payment_category: 'COMPANY_PAYMENT',
          party_id: partyId,
          payment_date: '2026-10-08',
          amount: 40000,
          payment_mode: 'UPI',
          allocations: [
            { allocation_type: 'BILL', allocated_amount: 40000, target_bill_id: billId }
          ]
        });

      expect(pay2Res.status).toBe(201);

      // Inspect bill: must be fully PAID!
      const billRes = await request(app).get(`/api/bills/${billId}`).set('Authorization', 'Bearer ' + caToken);
      expect(billRes.body.data.bill_status).toBe('PAID');
      expect(Number(billRes.body.data.total_amount)).toBe(90000);
      expect(Number(billRes.body.data.paid_amount)).toBe(90000);
      expect(Number(billRes.body.data.balance_amount)).toBe(0);
      expect(billRes.body.data.paid_at).not.toBeNull();
    });

    it('rejects version corrections and cancellations on a PAID bill (422)', async () => {
      // Correction attempt
      const corrAttempt = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          items: [{ trip_id: trip1Id, sequence_no: 1, description: 'Cannot edit paid bill', line_amount: 95000 }]
        });
      expect(corrAttempt.status).toBe(422);
      expect(corrAttempt.body.error.message).toContain('Cannot create versions for already paid bills');

      // Cancellation attempt
      const cancelAttempt = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ cancel_reason: 'Cannot cancel paid bill' });
      expect(cancelAttempt.status).toBe(422);
      expect(cancelAttempt.body.error.message).toContain('Cannot cancel a paid or already cancelled bill');
    });

    it('payment reversal restores balance and reverts bill status from PAID to SUBMITTED', async () => {
      // Reverse payment 1 (50,000)
      const rev1Res = await request(app)
        .post(`/api/payments/${paymentId}/reverse`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ reversal_reason: 'Testing reversal of first payment' });
      expect(rev1Res.status).toBe(200);

      // Status should revert to SUBMITTED and balance amount should become 50000
      const billRes = await request(app).get(`/api/bills/${billId}`).set('Authorization', 'Bearer ' + caToken);
      expect(billRes.body.data.bill_status).toBe('SUBMITTED');
      expect(Number(billRes.body.data.paid_amount)).toBe(40000);
      expect(Number(billRes.body.data.balance_amount)).toBe(50000);
      expect(billRes.body.data.paid_at).toBeNull();
    });
  });

  describe('F. Cancellation, Trip Release, Burnt Numbering, and Rebilling', () => {
    let billId: string;

    beforeAll(async () => {
      const res = await pool.query("SELECT id FROM bills WHERE bill_number = 'SRL/26-27/INV-1'");
      billId = res.rows[0].id;
    });

    it('rejects cancellation when bill still has active payment allocations (422)', async () => {
      const cancelAttempt = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ cancel_reason: 'Cancellation attempt with 40000 active allocation' });

      expect(cancelAttempt.status).toBe(422);
      expect(cancelAttempt.body.error.code).toBe('BILL_HAS_ACTIVE_ALLOCATIONS');
    });

    it('reverses remaining payment and successfully cancels bill by Owner with mandatory reason', async () => {
      // Find remaining active payment for this bill
      const activePayRes = await pool.query(
        "SELECT p.id FROM payments p JOIN payment_allocations pa ON p.id = pa.payment_id WHERE pa.bill_id = $1 AND pa.allocation_status = 'ACTIVE'",
        [billId]
      );
      for (const row of activePayRes.rows) {
        await request(app)
          .post(`/api/payments/${row.id}/reverse`)
          .set('Authorization', 'Bearer ' + ownerToken)
          .send({ reversal_reason: 'Reversing payment prior to bill cancellation' });
      }

      // Cancellation by Staff must be rejected (403)
      const staffCancel = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({ cancel_reason: 'Staff cancellation attempt' });
      expect(staffCancel.status).toBe(403);

      // Owner cancellation succeeds
      const cancelRes = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ cancel_reason: 'Client requested complete revision of billing period' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.bill_status).toBe('CANCELLED');
    });

    it('verifies cancelled trips are released and immediately eligible for rebilling', async () => {
      const eligibleRes = await request(app)
        .get(`/api/bills/eligible-trips?party_id=${partyId}`)
        .set('Authorization', 'Bearer ' + staffToken);

      expect(eligibleRes.status).toBe(200);
      const eligibleTripNumbers = eligibleRes.body.data.map((t: any) => t.trip_number);
      expect(eligibleTripNumbers).toContain('E2E-TRP-01');
      expect(eligibleTripNumbers).toContain('E2E-TRP-02');
      expect(eligibleTripNumbers).toContain('E2E-TRP-03');
    });

    it('verifies cancelled bill number is burnt and subsequent generation uses next sequential number', async () => {
      // SRL/26-27/INV-1 was cancelled. Next generated bill MUST receive SRL/26-27/INV-2!
      const newBillRes = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          financial_year_id: fy26Id,
          numbering_series_id: mainSeriesId,
          billing_mode: 'CONSOLIDATED',
          bill_date: '2026-10-09',
          trip_ids: [trip1Id, trip2Id, trip3Id],
          template_snapshot: {}
        });

      expect(newBillRes.status).toBe(201);
      expect(newBillRes.body.data.bill.bill_number).toBe('SRL/26-27/INV-2');
      expect(Number(newBillRes.body.data.bill.total_amount)).toBe(105000); // 45k + 35k + 25k
    });
  });

  describe('G. Comprehensive RBAC Matrix Verification', () => {
    it('CA role cannot perform any mutations across billing, template, series, and payment APIs (403)', async () => {
      // Bill generation
      const gen = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + caToken)
        .send({});
      expect(gen.status).toBe(403);

      // Bill submit
      const sub = await request(app)
        .post('/api/bills/00000000-0000-0000-0000-000000000000/submit')
        .set('Authorization', 'Bearer ' + caToken);
      expect(sub.status).toBe(403);

      // Bill cancel
      const can = await request(app)
        .post('/api/bills/00000000-0000-0000-0000-000000000000/cancel')
        .set('Authorization', 'Bearer ' + caToken)
        .send({ cancel_reason: 'test' });
      expect(can.status).toBe(403);

      // Template create
      const tmpl = await request(app)
        .post('/api/bill-templates')
        .set('Authorization', 'Bearer ' + caToken)
        .send({});
      expect(tmpl.status).toBe(403);

      // Series create
      const ser = await request(app)
        .post('/api/numbering-series')
        .set('Authorization', 'Bearer ' + caToken)
        .send({});
      expect(ser.status).toBe(403);

      // Payment create
      const pay = await request(app)
        .post('/api/payments')
        .set('Authorization', 'Bearer ' + caToken)
        .send({});
      expect(pay.status).toBe(403);
    });

    it('CA role can read-only access bills list, bill details, versions, and stream PDFs (200)', async () => {
      const listRes = await request(app).get('/api/bills').set('Authorization', 'Bearer ' + caToken);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);

      const billId = listRes.body.data[0].id;
      const detailRes = await request(app).get(`/api/bills/${billId}`).set('Authorization', 'Bearer ' + caToken);
      expect(detailRes.status).toBe(200);

      const pdfRes = await request(app).get(`/api/bills/${billId}/pdf`).set('Authorization', 'Bearer ' + caToken);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toBe('application/pdf');
    });
  });
});
