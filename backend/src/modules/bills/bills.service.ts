import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import Decimal from 'decimal.js';
import { storageService } from '../../services/storage.service';
import { generateBillPdfBuffer } from './bill-pdf.generator';
import { Readable } from 'stream';
import { getTemplateById } from '../bill-templates/bill-templates.service';
import { resolveDynamicFields } from '../bill-templates/dynamic-fields.resolver';

export const generateBill = async (data: any, userId: string) => {
  return withTransaction(async (client) => {
    if (!data.trip_ids || data.trip_ids.length === 0) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'At least one trip must be selected.', 400);
    }

    if (data.billing_mode === 'INDIVIDUAL' && data.trip_ids.length > 1) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'INDIVIDUAL billing mode only supports one trip per bill.', 400);
    }

    const tripsParams = data.trip_ids.map((_: any, i: number) => '$' + (i + 2)).join(',');
    const tripsQuery =
      'SELECT t.id, t.trip_number, t.status, t.party_id, p.pod_received_at, p.pod_status, pf.receivable_amount ' +
      'FROM trips t ' +
      'LEFT JOIN trip_pods p ON t.id = p.trip_id ' +
      'LEFT JOIN trip_party_financials pf ON t.id = pf.trip_id ' +
      'WHERE t.id IN (' + tripsParams + ') AND t.party_id = $1';
    const tripsRes = await client.query(tripsQuery, [data.party_id, ...data.trip_ids]);

    if (tripsRes.rows.length !== data.trip_ids.length) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Some trips were not found or do not belong to the selected party.', 422);
    }

    let totalAmount = new Decimal(0);
    const lineItems: any[] = [];

    for (const [index, trip] of tripsRes.rows.entries()) {
      if (trip.status !== 'COMPLETED') {
        throw new AppError('BUSINESS_RULE_VIOLATION', 'Trip ' + trip.trip_number + ' is not in COMPLETED status.', 422);
      }

      const podIsReceived = trip.pod_received_at !== null || ['RECEIVED', 'SENT', 'DISPATCHED'].includes(trip.pod_status);
      if (!podIsReceived) {
        throw new AppError('BUSINESS_RULE_VIOLATION', 'Trip ' + trip.trip_number + ' does not have a received POD.', 422);
      }

      const activeBillCheck = await client.query(
        "SELECT b.id FROM bill_items bi JOIN bills b ON bi.bill_id = b.id WHERE bi.trip_id = $1 AND b.bill_status != 'CANCELLED'",
        [trip.id]
      );
      if (activeBillCheck.rows.length > 0) {
        throw new AppError('BUSINESS_RULE_VIOLATION', 'Trip ' + trip.trip_number + ' is already in an active bill.', 422);
      }

      const amount = new Decimal(trip.receivable_amount || 0);
      totalAmount = totalAmount.plus(amount);

      lineItems.push({
        trip_id: trip.id,
        sequence_no: index + 1,
        description: 'Freight charges for Trip ' + trip.trip_number,
        line_amount: amount.toNumber()
      });
    }

    const seqQuery =
      'UPDATE bill_numbering_series SET current_number = current_number + 1, updated_at = now() WHERE id = $1 AND party_id = $2 AND financial_year_id = $3 AND is_active = true RETURNING prefix, current_number';
    const seqRes = await client.query(seqQuery, [data.numbering_series_id, data.party_id, data.financial_year_id]);
    if (seqRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Numbering series not found, inactive, or does not match party and financial year.', 404);
    }
    const { prefix, current_number } = seqRes.rows[0];
    const billNumber = prefix + current_number;

    const bQuery =
      "INSERT INTO bills (bill_number, party_id, financial_year_id, bill_status, billing_mode, bill_date, created_by) VALUES ($1, $2, $3, 'GENERATED', $4, $5, $6) RETURNING *";
    const bRes = await client.query(bQuery, [
      billNumber,
      data.party_id,
      data.financial_year_id,
      data.billing_mode,
      data.bill_date,
      userId
    ]);
    const bill = bRes.rows[0];

    for (const item of lineItems) {
      await client.query(
        'INSERT INTO bill_items (bill_id, trip_id, sequence_no, description, line_amount) VALUES ($1, $2, $3, $4, $5)',
        [bill.id, item.trip_id, item.sequence_no, item.description, item.line_amount]
      );
    }

    const vQuery =
      "INSERT INTO bill_versions (bill_id, version_number, version_label, version_status, template_id, template_snapshot, resolved_dynamic_fields, created_by) VALUES ($1, 1, 'Version 1', 'ACTIVE', $2, $3, $4, $5) RETURNING *";

    let templateIdToUse = data.template_id || null;
    const pbcRes = await client.query('SELECT billing_mode, default_template_id FROM party_billing_configs WHERE party_id = $1', [data.party_id]);
    if (pbcRes.rows.length > 0) {
      const pbc = pbcRes.rows[0];
      if (pbc.billing_mode && data.billing_mode && pbc.billing_mode !== data.billing_mode) {
        throw new AppError(
          'BUSINESS_RULE_VIOLATION',
          `Billing mode '${data.billing_mode}' does not match company configured billing mode '${pbc.billing_mode}'.`,
          422
        );
      }
      if (!templateIdToUse && pbc.default_template_id) {
        templateIdToUse = pbc.default_template_id;
      }
    }

    let snapshot = data.template_snapshot || {};
    if (templateIdToUse && (!snapshot.components || snapshot.components.length === 0)) {
      try {
        const tmpl = await getTemplateById(templateIdToUse, client);
        if (tmpl) {
          snapshot = {
            layout: tmpl.layout_json || snapshot.layout || {},
            components: tmpl.components || [],
            assets: tmpl.assets || [],
            dynamic_field_definitions: tmpl.dynamic_fields || []
          };
        }
      } catch {
        // Fallback to empty snapshot if template not found
      }
    }

    if (!snapshot.layout) snapshot.layout = {};
    if (!snapshot.components) snapshot.components = [];
    if (!snapshot.assets) snapshot.assets = [];
    if (!snapshot.dynamic_field_definitions) snapshot.dynamic_field_definitions = [];

    let resolvedFields = data.resolved_dynamic_fields;
    if (!resolvedFields || Object.keys(resolvedFields).length === 0) {
      const partyRes = await client.query('SELECT * FROM parties WHERE id = $1', [data.party_id]);
      resolvedFields = resolveDynamicFields(bill, partyRes.rows[0], tripsRes.rows, lineItems);
    }

    const vRes = await client.query(vQuery, [
      bill.id,
      templateIdToUse,
      snapshot,
      resolvedFields || {},
      userId
    ]);

    const version = vRes.rows[0];

    for (const item of lineItems) {
      await client.query(
        'INSERT INTO bill_version_items (bill_version_id, trip_id, sequence_no, description, line_amount) VALUES ($1, $2, $3, $4, $5)',
        [version.id, item.trip_id, item.sequence_no, item.description, item.line_amount]
      );
    }

    await createAudit({ entityType: 'BILL', entityId: bill.id, action: 'CREATE', newState: bill, userId }, client);

    const finalBillRes = await client.query('SELECT * FROM bills WHERE id = $1', [bill.id]);
    return { bill: finalBillRes.rows[0], version };
  });
};

export const checkEligibility = async (data: any) => {
  const tripsParams = data.trip_ids.map((_: any, i: number) => '$' + (i + 2)).join(',');
  const tripsQuery =
    'SELECT t.id, t.trip_number, t.status, p.pod_received_at, p.pod_status, ' +
    "EXISTS (SELECT 1 FROM bill_items bi JOIN bills b ON bi.bill_id = b.id WHERE bi.trip_id = t.id AND b.bill_status != 'CANCELLED') as has_active_bill " +
    'FROM trips t ' +
    'LEFT JOIN trip_pods p ON t.id = p.trip_id ' +
    'WHERE t.id IN (' + tripsParams + ') AND t.party_id = $1';
  const { rows } = await query(tripsQuery, [data.party_id, ...data.trip_ids]);

  return rows.map((r: any) => ({
    trip_id: r.id,
    trip_number: r.trip_number,
    is_eligible:
      r.status === 'COMPLETED' &&
      (r.pod_received_at !== null || ['RECEIVED', 'SENT', 'DISPATCHED'].includes(r.pod_status)) &&
      !r.has_active_bill,
    status: r.status,
    pod_received: r.pod_received_at !== null || ['RECEIVED', 'SENT', 'DISPATCHED'].includes(r.pod_status),
    has_active_bill: r.has_active_bill
  }));
};

export const listBills = async (filters: any = {}) => {
  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (filters.search && filters.search.trim()) {
    params.push(`%${filters.search.trim()}%`);
    conditions.push(`(b.bill_number ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
  }

  if (filters.party_id) {
    params.push(filters.party_id);
    conditions.push(`b.party_id = $${params.length}`);
  }

  if (filters.bill_status) {
    params.push(filters.bill_status);
    conditions.push(`b.bill_status = $${params.length}`);
  }

  if (filters.from_date) {
    params.push(filters.from_date);
    conditions.push(`b.bill_date >= $${params.length}`);
  }

  if (filters.to_date) {
    params.push(filters.to_date);
    conditions.push(`b.bill_date <= $${params.length}`);
  }

  if (filters.financial_year_id) {
    params.push(filters.financial_year_id);
    conditions.push(`b.financial_year_id = $${params.length}`);
  }

  if (filters.billing_mode) {
    params.push(filters.billing_mode);
    conditions.push(`b.billing_mode = $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  // Count total matching records
  const countQuery = `
    SELECT COUNT(DISTINCT b.id) AS total
    FROM bills b
    JOIN parties p ON b.party_id = p.id
    JOIN financial_years fy ON b.financial_year_id = fy.id
    WHERE ${whereClause}
  `;
  const countRes = await query(countQuery, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  // Sorting
  const sortFieldMap: Record<string, string> = {
    bill_date: 'b.bill_date',
    bill_number: 'b.bill_number',
    total_amount: 'b.total_amount',
    created_at: 'b.created_at'
  };
  const sortField = sortFieldMap[filters.sort_by] || 'b.created_at';
  const sortDirection = String(filters.sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Pagination
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const dataParams = [...params, limit, offset];
  const dataQuery = `
    SELECT 
      b.id,
      b.bill_number,
      b.party_id,
      p.name AS party_name,
      b.financial_year_id,
      fy.code AS financial_year_code,
      b.billing_mode,
      b.bill_date,
      b.bill_status,
      b.total_amount,
      b.balance_amount,
      GREATEST(b.total_amount - b.balance_amount, 0) AS paid_amount,
      COALESCE(MAX(bv.version_number), 1) AS current_version,
      b.submitted_at,
      b.paid_at,
      b.created_by,
      b.created_at,
      b.updated_at
    FROM bills b
    JOIN parties p ON b.party_id = p.id
    JOIN financial_years fy ON b.financial_year_id = fy.id
    LEFT JOIN bill_versions bv ON b.id = bv.bill_id
    WHERE ${whereClause}
    GROUP BY b.id, p.name, fy.code
    ORDER BY ${sortField} ${sortDirection}, b.id DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
  `;

  const { rows } = await query(dataQuery, dataParams);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

export const getBill = async (id: string) => {
  const { rows: billRows } = await query(
    `SELECT 
      b.*,
      GREATEST(b.total_amount - b.balance_amount, 0) AS paid_amount,
      p.name AS party_name,
      p.primary_mobile AS party_primary_mobile,
      p.gstin AS party_gstin,
      p.full_address AS party_address,
      p.city AS party_city,
      p.state AS party_state,
      p.pin_code AS party_pin_code,
      p.billing_address AS party_billing_address,
      fy.code AS financial_year_code,
      fy.start_date AS financial_year_start_date,
      fy.end_date AS financial_year_end_date,
      u_created.name AS created_by_name,
      u_cancelled.name AS cancelled_by_name
    FROM bills b
    JOIN parties p ON b.party_id = p.id
    JOIN financial_years fy ON b.financial_year_id = fy.id
    LEFT JOIN users u_created ON b.created_by = u_created.id
    LEFT JOIN users u_cancelled ON b.cancelled_by = u_cancelled.id
    WHERE b.id = $1`,
    [id]
  );
  if (billRows.length === 0) throw new AppError('NOT_FOUND', 'Bill not found', 404);
  const bill = billRows[0];

  const { rows: itemRows } = await query(
    `SELECT 
      bi.id,
      bi.bill_id,
      bi.trip_id,
      bi.sequence_no,
      bi.description,
      bi.quantity,
      bi.unit_price,
      bi.line_amount,
      bi.is_active,
      t.trip_number,
      t.trip_date,
      COALESCE(mv.vehicle_number, ofv.vehicle_number) AS vehicle_number,
      t.origin AS route_origin,
      t.destination AS route_destination
    FROM bill_items bi
    LEFT JOIN trips t ON bi.trip_id = t.id
    LEFT JOIN market_vehicles mv ON t.market_vehicle_id = mv.id
    LEFT JOIN own_fleet_vehicles ofv ON t.own_fleet_vehicle_id = ofv.id
    WHERE bi.bill_id = $1
    ORDER BY bi.sequence_no ASC`,
    [id]
  );

  const { rows: versionRows } = await query(
    `SELECT 
      bv.*,
      u.name AS creator_name
    FROM bill_versions bv
    LEFT JOIN users u ON bv.created_by = u.id
    WHERE bv.bill_id = $1
    ORDER BY bv.version_number DESC`,
    [id]
  );

  for (const v of versionRows) {
    const { rows: vItemRows } = await query(
      `SELECT 
        bvi.*,
        t.trip_number,
        t.trip_date,
        COALESCE(mv.vehicle_number, ofv.vehicle_number) AS vehicle_number,
        t.origin AS route_origin,
        t.destination AS route_destination
      FROM bill_version_items bvi
      LEFT JOIN trips t ON bvi.trip_id = t.id
      LEFT JOIN market_vehicles mv ON t.market_vehicle_id = mv.id
      LEFT JOIN own_fleet_vehicles ofv ON t.own_fleet_vehicle_id = ofv.id
      WHERE bvi.bill_version_id = $1
      ORDER BY bvi.sequence_no ASC`,
      [v.id]
    );
    v.items = vItemRows;
  }

  const { rows: allocationRows } = await query(
    `SELECT 
      pa.id,
      pa.payment_id,
      p.payment_id AS payment_number,
      p.payment_date,
      p.payment_type,
      p.payment_mode,
      p.payment_status,
      pa.allocation_type,
      pa.allocation_amount,
      pa.allocation_status,
      pa.reversed_at,
      pa.created_at,
      u.name AS created_by_name
    FROM payment_allocations pa
    LEFT JOIN payments p ON pa.payment_id = p.id
    LEFT JOIN users u ON pa.created_by = u.id
    WHERE pa.bill_id = $1
    ORDER BY pa.created_at DESC`,
    [id]
  );

  const party = {
    id: bill.party_id,
    name: bill.party_name,
    primary_mobile: bill.party_primary_mobile,
    gstin: bill.party_gstin,
    address: bill.party_address,
    city: bill.party_city,
    state: bill.party_state,
    pin_code: bill.party_pin_code,
    billing_address: bill.party_billing_address
  };

  const financial_year = {
    id: bill.financial_year_id,
    code: bill.financial_year_code,
    start_date: bill.financial_year_start_date,
    end_date: bill.financial_year_end_date
  };

  const creator = {
    id: bill.created_by,
    name: bill.created_by_name
  };

  const canceller = bill.cancelled_by
    ? {
        id: bill.cancelled_by,
        name: bill.cancelled_by_name
      }
    : null;

  return {
    ...bill,
    party,
    financial_year,
    creator,
    canceller,
    current_version: versionRows[0]?.version_number || 1,
    items: itemRows,
    versions: versionRows,
    allocations: allocationRows
  };
};

export const submitBill = async (id: string, userId: string) => {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM bills WHERE id = $1 FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Bill not found', 404);

    const bill = rows[0];
    if (bill.bill_status !== 'GENERATED') {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Only GENERATED bills can be submitted.', 422);
    }

    const { rows: updated } = await client.query(
      "UPDATE bills SET bill_status = 'SUBMITTED', submitted_at = now(), updated_at = now() WHERE id = $1 RETURNING *",
      [id]
    );

    await createAudit({ entityType: 'BILL', entityId: id, action: 'SUBMIT', newState: updated[0], userId }, client);
    return updated[0];
  });
};

export const cancelBill = async (id: string, cancelReason: string, userId: string) => {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM bills WHERE id = $1 FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Bill not found', 404);

    const bill = rows[0];
    if (['PAID', 'CANCELLED'].includes(bill.bill_status)) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot cancel a paid or already cancelled bill.', 422);
    }

    const { rows: allocCheck } = await client.query(
      "SELECT COALESCE(SUM(allocation_amount), 0) AS active_alloc_sum FROM payment_allocations WHERE bill_id = $1 AND allocation_status = 'ACTIVE'",
      [id]
    );
    const activeAllocSum = new Decimal(allocCheck[0]?.active_alloc_sum || 0);
    if (activeAllocSum.greaterThan(0)) {
      throw new AppError(
        'BILL_HAS_ACTIVE_ALLOCATIONS',
        'Cannot cancel bill with active payment allocations. Reallocate or reverse payments first.',
        422
      );
    }

    const { rows: updated } = await client.query(
      "UPDATE bills SET bill_status = 'CANCELLED', cancel_reason = $2, cancelled_by = $3, cancelled_at = now(), updated_at = now() WHERE id = $1 RETURNING *",
      [id, cancelReason, userId]
    );

    await client.query(
      "UPDATE bill_versions SET version_status = 'CANCELLED' WHERE bill_id = $1 AND version_status = 'ACTIVE'",
      [id]
    );

    await createAudit({ entityType: 'BILL', entityId: id, action: 'CANCEL', newState: updated[0], userId }, client);
    return updated[0];
  });
};

export const createVersion = async (id: string, data: any, userId: string) => {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM bills WHERE id = $1 FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Bill not found', 404);
    const bill = rows[0];

    if (bill.bill_status === 'CANCELLED') {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot create versions for cancelled bills.', 422);
    }
    if (bill.bill_status === 'PAID') {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot create versions for already paid bills.', 422);
    }

    const { rows: versions } = await client.query(
      'SELECT version_number, template_id FROM bill_versions WHERE bill_id = $1 ORDER BY version_number DESC LIMIT 1',
      [id]
    );
    const nextVersion = (versions[0]?.version_number || 0) + 1;


    let snapshot = data.template_snapshot || {};
    if (!snapshot.layout) snapshot.layout = {};
    if (!snapshot.components) snapshot.components = [];
    if (!snapshot.assets) snapshot.assets = [];
    if (!snapshot.dynamic_field_definitions) snapshot.dynamic_field_definitions = [];

    // Prepare items
    let finalItems: any[] = [];
    let lineSum = new Decimal(0);

    if (data.items && Array.isArray(data.items)) {
      if (data.items.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'A bill must have at least one line item.', 400);
      }

      if (bill.billing_mode === 'INDIVIDUAL') {
        const distinctTrips = new Set(data.items.map((it: any) => it.trip_id).filter(Boolean));
        if (distinctTrips.size > 1) {
          throw new AppError('BUSINESS_RULE_VIOLATION', 'INDIVIDUAL billing mode only supports one trip per bill.', 422);
        }
      }

      // Check active payment allocation sum against new total
      const { rows: allocCheck } = await client.query(
        "SELECT COALESCE(SUM(allocation_amount), 0) AS active_alloc_sum FROM payment_allocations WHERE bill_id = $1 AND allocation_status = 'ACTIVE'",
        [id]
      );
      const activeAllocSum = new Decimal(allocCheck[0]?.active_alloc_sum || 0);

      const seqSet = new Set<number>();

      for (const item of data.items) {
        if (!item.sequence_no || item.sequence_no <= 0) {
          throw new AppError('VALIDATION_ERROR', 'Sequence number must be a positive integer.', 400);
        }
        if (seqSet.has(item.sequence_no)) {
          throw new AppError('VALIDATION_ERROR', `Duplicate sequence number ${item.sequence_no}`, 400);
        }
        seqSet.add(item.sequence_no);

        const amt = new Decimal(item.line_amount ?? 0);
        if (amt.lessThan(0)) {
          throw new AppError('VALIDATION_ERROR', 'Line amount cannot be negative.', 400);
        }
        lineSum = lineSum.plus(amt);

        if (item.trip_id) {
          const { rows: tripRows } = await client.query(
            `SELECT t.id, t.trip_number, t.status, t.party_id, p.pod_received_at, p.pod_status
             FROM trips t
             LEFT JOIN trip_pods p ON t.id = p.trip_id
             WHERE t.id = $1`,
            [item.trip_id]
          );
          if (tripRows.length === 0 || tripRows[0].party_id !== bill.party_id) {
            throw new AppError('BUSINESS_RULE_VIOLATION', 'Trip not found or does not belong to bill party.', 422);
          }
          const trip = tripRows[0];
          if (trip.status !== 'COMPLETED') {
            throw new AppError('BUSINESS_RULE_VIOLATION', `Trip ${trip.trip_number} is not in COMPLETED status.`, 422);
          }
          const podIsReceived = trip.pod_received_at !== null || ['RECEIVED', 'SENT', 'DISPATCHED'].includes(trip.pod_status);
          if (!podIsReceived) {
            throw new AppError('BUSINESS_RULE_VIOLATION', `Trip ${trip.trip_number} does not have a received POD.`, 422);
          }

          // Ensure trip is not linked to any OTHER active bill
          const { rows: otherBills } = await client.query(
            `SELECT b.bill_number FROM bill_items bi 
             JOIN bills b ON bi.bill_id = b.id 
             WHERE bi.trip_id = $1 AND b.id != $2 AND b.bill_status != 'CANCELLED'`,
            [item.trip_id, id]
          );
          if (otherBills.length > 0) {
            throw new AppError(
              'BUSINESS_RULE_VIOLATION',
              `Trip ${trip.trip_number} is already billed in active bill ${otherBills[0].bill_number}.`,
              422
            );
          }
        }

        finalItems.push({
          trip_id: item.trip_id || null,
          sequence_no: item.sequence_no,
          description: item.description,
          quantity: item.quantity ?? null,
          unit_price: item.unit_price ?? null,
          line_amount: amt.toNumber()
        });
      }

      if (lineSum.lessThan(activeAllocSum)) {
        throw new AppError(
          'BILLING_VIOLATION',
          `Corrected bill total (${lineSum.toFixed(2)}) cannot be less than active payment allocations (${activeAllocSum.toFixed(2)}).`,
          422
        );
      }
    } else {
      const { rows: items } = await client.query(
        'SELECT trip_id, sequence_no, description, quantity, unit_price, line_amount FROM bill_items WHERE bill_id = $1 ORDER BY sequence_no ASC',
        [id]
      );
      finalItems = items;
      lineSum = items.reduce((acc: Decimal, it: any) => acc.plus(it.line_amount || 0), new Decimal(0));
    }

    // Supersede previous active version(s)
    await client.query("UPDATE bill_versions SET version_status = 'SUPERSEDED' WHERE bill_id = $1 AND version_status = 'ACTIVE'", [id]);

    const totalsSnapshot = data.totals_snapshot || {
      total_amount: lineSum.toNumber(),
      line_count: finalItems.length
    };
    const headerSnapshot = data.header_snapshot || {
      bill_number: bill.bill_number,
      bill_date: bill.bill_date,
      billing_mode: bill.billing_mode
    };

    let resolvedFields = data.resolved_dynamic_fields;
    if (!resolvedFields || Object.keys(resolvedFields).length === 0) {
      const partyRes = await client.query('SELECT * FROM parties WHERE id = $1', [bill.party_id]);
      const { rows: versionTrips } = await client.query(
        'SELECT t.*, pf.receivable_amount FROM trips t LEFT JOIN trip_party_financials pf ON t.id = pf.trip_id WHERE t.id IN (SELECT trip_id FROM bill_items WHERE bill_id = $1 AND trip_id IS NOT NULL)',
        [id]
      );
      resolvedFields = resolveDynamicFields(bill, partyRes.rows[0], versionTrips, finalItems);
    }

    const vQuery =
      "INSERT INTO bill_versions (bill_id, version_number, version_label, version_status, template_id, template_snapshot, header_snapshot, totals_snapshot, resolved_dynamic_fields, created_by) VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7, $8, $9) RETURNING *";
    const vRes = await client.query(vQuery, [
      bill.id,
      nextVersion,
      'Version ' + nextVersion,
      data.template_id !== undefined ? data.template_id : (versions[0]?.template_id || null),
      snapshot,
      headerSnapshot,
      totalsSnapshot,
      resolvedFields || {},
      userId
    ]);

    const version = vRes.rows[0];

    // If items were modified, synchronize bill_items
    if (data.items && Array.isArray(data.items)) {
      await client.query('DELETE FROM bill_items WHERE bill_id = $1', [id]);
      for (const item of finalItems) {
        await client.query(
          'INSERT INTO bill_items (bill_id, trip_id, sequence_no, description, quantity, unit_price, line_amount) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [bill.id, item.trip_id, item.sequence_no, item.description, item.quantity, item.unit_price, item.line_amount]
        );
      }
    }

    // Insert bill_version_items for the new version
    for (const item of finalItems) {
      await client.query(
        'INSERT INTO bill_version_items (bill_version_id, trip_id, sequence_no, description, quantity, unit_price, line_amount) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [version.id, item.trip_id, item.sequence_no, item.description, item.quantity, item.unit_price, item.line_amount]
      );
    }

    await createAudit({ entityType: 'BILL_VERSION', entityId: version.id, action: 'CREATE', newState: version, userId }, client);

    const { rows: updatedBills } = await client.query('SELECT * FROM bills WHERE id = $1', [id]);
    await createAudit(
      { entityType: 'BILL', entityId: id, action: 'CORRECTION', previousState: bill, newState: updatedBills[0], userId },
      client
    );

    return version;
  });
};

export const getEligibleTrips = async (partyId: string) => {
  const q = `
    SELECT 
      t.id,
      t.trip_number,
      t.trip_date,
      t.loading_date,
      t.unloading_date,
      t.origin AS route_origin,
      t.destination AS route_destination,
      COALESCE(mv.vehicle_number, ofv.vehicle_number) AS vehicle_number,
      t.vehicle_relationship,
      t.status,
      p.pod_status,
      p.pod_received_at,
      COALESCE(tpf.receivable_amount, 0) AS receivable_amount,
      COALESCE(tpf.freight_amount, 0) AS freight_amount,
      COALESCE(tpf.detention_amount, 0) AS detention_amount
    FROM trips t
    LEFT JOIN trip_pods p ON t.id = p.trip_id
    LEFT JOIN trip_party_financials tpf ON t.id = tpf.trip_id
    LEFT JOIN market_vehicles mv ON t.market_vehicle_id = mv.id
    LEFT JOIN own_fleet_vehicles ofv ON t.own_fleet_vehicle_id = ofv.id
    WHERE t.party_id = $1
      AND t.status = 'COMPLETED'
      AND (p.pod_received_at IS NOT NULL OR p.pod_status IN ('RECEIVED', 'SENT', 'DISPATCHED'))
      AND NOT EXISTS (
        SELECT 1 FROM bill_items bi 
        JOIN bills b ON bi.bill_id = b.id 
        WHERE bi.trip_id = t.id AND b.bill_status != 'CANCELLED'
      )
    ORDER BY t.trip_date DESC, t.trip_number DESC
  `;
  const { rows } = await query(q, [partyId]);
  return rows;
};

export const getNumberingSeries = async (partyId?: string, financialYearId?: string) => {
  let q = `
    SELECT 
      bns.id,
      bns.party_id,
      p.name AS party_name,
      bns.financial_year_id,
      fy.code AS financial_year_code,
      bns.series_code,
      bns.prefix,
      bns.current_number,
      bns.is_active
    FROM bill_numbering_series bns
    JOIN parties p ON bns.party_id = p.id
    JOIN financial_years fy ON bns.financial_year_id = fy.id
    WHERE bns.is_active = true
  `;
  const params: any[] = [];
  if (partyId) {
    params.push(partyId);
    q += ` AND bns.party_id = $${params.length}`;
  }
  if (financialYearId) {
    params.push(financialYearId);
    q += ` AND bns.financial_year_id = $${params.length}`;
  }
  q += ` ORDER BY bns.series_code ASC`;
  const { rows } = await query(q, params);
  return rows;
};

export const getBillVersion = async (billId: string, versionNumber: number) => {
  const { rows: billRows } = await query('SELECT id FROM bills WHERE id = $1', [billId]);
  if (billRows.length === 0) throw new AppError('NOT_FOUND', 'Bill not found', 404);

  const { rows: versionRows } = await query(
    `SELECT 
      bv.*,
      u.name AS creator_name
    FROM bill_versions bv
    LEFT JOIN users u ON bv.created_by = u.id
    WHERE bv.bill_id = $1 AND bv.version_number = $2`,
    [billId, versionNumber]
  );
  if (versionRows.length === 0) {
    throw new AppError('NOT_FOUND', `Bill version ${versionNumber} not found`, 404);
  }
  const version = versionRows[0];

  const { rows: itemRows } = await query(
    `SELECT 
      bvi.*,
      t.trip_number,
      t.trip_date,
      COALESCE(mv.vehicle_number, ofv.vehicle_number) AS vehicle_number,
      t.origin AS route_origin,
      t.destination AS route_destination
    FROM bill_version_items bvi
    LEFT JOIN trips t ON bvi.trip_id = t.id
    LEFT JOIN market_vehicles mv ON t.market_vehicle_id = mv.id
    LEFT JOIN own_fleet_vehicles ofv ON t.own_fleet_vehicle_id = ofv.id
    WHERE bvi.bill_version_id = $1
    ORDER BY bvi.sequence_no ASC`,
    [version.id]
  );

  return {
    ...version,
    items: itemRows
  };
};

export const getBillPdf = async (id: string, versionNumber?: number) => {
  const bill = await getBill(id);

  let targetVersion: any;
  if (versionNumber !== undefined && versionNumber !== null && !isNaN(Number(versionNumber))) {
    const v = bill.versions.find((ver: any) => Number(ver.version_number) === Number(versionNumber));
    if (!v) {
      throw new AppError('NOT_FOUND', `Bill version ${versionNumber} not found`, 404);
    }
    targetVersion = v;
  } else {
    targetVersion = bill.versions.find((ver: any) => ver.version_status === 'ACTIVE') || bill.versions[0];
  }

  const vNum = targetVersion ? targetVersion.version_number : (bill.current_version || 1);
  const storageKey = `bills/${bill.id}/v${vNum}.pdf`;

  const fileExists = await storageService.exists(storageKey);
  if (!fileExists) {
    // If template snapshot has required assets, ensure they physically exist in storage before regenerating
    const snapshotAssets = targetVersion?.template_snapshot?.assets || [];
    const snapshotComps = targetVersion?.template_snapshot?.components || [];
    for (const comp of snapshotComps) {
      if (['IMAGE', 'LOGO', 'SIGNATURE', 'STAMP'].includes(comp.component_type) && (comp.content_json?.required === true || comp.content_json?.is_required === true)) {
        const matchingAsset = snapshotAssets.find((a: any) =>
          (comp.content_json?.storage_key && a.storage_key === comp.content_json.storage_key) ||
          (comp.content_json?.asset_id && a.id === comp.content_json.asset_id) ||
          (comp.content_json?.asset_type && a.asset_type === comp.content_json.asset_type) ||
          (a.asset_type === comp.component_type)
        );
        if (matchingAsset && matchingAsset.storage_key) {
          const assetPhysicalExists = await storageService.exists(matchingAsset.storage_key);
          if (!assetPhysicalExists) {
            throw new AppError(
              'BUSINESS_RULE_VIOLATION',
              `Required asset file "${matchingAsset.file_name}" (${matchingAsset.storage_key}) is missing from storage for historical bill version ${vNum}`,
              422
            );
          }
        }
      }
    }

    // Collect version items directly from bill_version_items of the target version
    const versionItems = (targetVersion && Array.isArray(targetVersion.items) && targetVersion.items.length > 0)
      ? targetVersion.items
      : bill.items;

    const versionTotal = versionItems.reduce(
      (sum: number, it: any) => sum + Number(it.line_amount || 0),
      0
    );

    const pdfData = {
      ...bill,
      version_number: vNum,
      version_label: targetVersion?.version_label || `Version ${vNum}`,
      version_status: targetVersion?.version_status || bill.bill_status,
      template_snapshot: targetVersion?.template_snapshot || {},
      items: versionItems,
      total_amount: versionTotal,
      paid_amount: bill.paid_amount,
      balance_amount: Math.max(0, versionTotal - Number(bill.paid_amount || 0))
    };

    const pdfBuffer = generateBillPdfBuffer(pdfData);
    const stream = Readable.from(pdfBuffer);
    await storageService.upload(storageKey, stream);
  }

  return {
    storageKey,
    billNumber: bill.bill_number,
    versionNumber: vNum,
    stream: storageService.getStream(storageKey)
  };
};
