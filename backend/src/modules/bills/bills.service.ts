import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import Decimal from 'decimal.js';

export const generateBill = async (data: any, userId: string) => {
  return withTransaction(async (client) => {
    if (data.trip_ids.length === 0) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'At least one trip must be selected.', 400);
    }

    if (data.billing_mode === 'INDIVIDUAL' && data.trip_ids.length > 1) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'INDIVIDUAL billing mode only supports one trip per bill.', 400);
    }

    const tripsParams = data.trip_ids.map((_: any, i: number) => "$" + (i + 2)).join(',');
    const tripsQuery = "SELECT t.id, t.trip_number, t.status, t.party_id, p.pod_received_at, p.pod_status, pf.receivable_amount FROM trips t LEFT JOIN trip_pods p ON t.id = p.trip_id LEFT JOIN trip_party_financials pf ON t.id = pf.trip_id WHERE t.id IN (" + tripsParams + ") AND t.party_id = $1";
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

    const seqQuery = "UPDATE bill_numbering_series SET current_number = current_number + 1, updated_at = now() WHERE id = $1 AND is_active = true RETURNING prefix, current_number";
    const seqRes = await client.query(seqQuery, [data.numbering_series_id]);
    if (seqRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Numbering series not found or inactive.', 404);
    }
    const { prefix, current_number } = seqRes.rows[0];
    const billNumber = prefix + current_number;

    const bQuery = "INSERT INTO bills (bill_number, party_id, financial_year_id, bill_status, billing_mode, bill_date, created_by) VALUES ($1, $2, $3, 'GENERATED', $4, $5, $6) RETURNING *";
    const bRes = await client.query(bQuery, [
      billNumber, data.party_id, data.financial_year_id, data.billing_mode, data.bill_date, userId
    ]);
    const bill = bRes.rows[0];

    for (const item of lineItems) {
      await client.query(
        "INSERT INTO bill_items (bill_id, trip_id, sequence_no, description, line_amount) VALUES ($1, $2, $3, $4, $5)",
        [bill.id, item.trip_id, item.sequence_no, item.description, item.line_amount]
      );
    }

    const vQuery = "INSERT INTO bill_versions (bill_id, version_number, version_label, version_status, template_id, template_snapshot, resolved_dynamic_fields, created_by) VALUES ($1, 1, 'Version 1', 'ACTIVE', $2, $3, $4, $5) RETURNING *";
    
    let snapshot = data.template_snapshot || {};
    if (!snapshot.layout) snapshot.layout = {};
    if (!snapshot.components) snapshot.components = [];
    if (!snapshot.assets) snapshot.assets = [];
    if (!snapshot.dynamic_field_definitions) snapshot.dynamic_field_definitions = [];
    
    const vRes = await client.query(vQuery, [
      bill.id,
      data.template_id || null,
      snapshot,
      data.resolved_dynamic_fields || {},
      userId
    ]);
    const version = vRes.rows[0];

    for (const item of lineItems) {
      await client.query(
        "INSERT INTO bill_version_items (bill_version_id, trip_id, sequence_no, description, line_amount) VALUES ($1, $2, $3, $4, $5)",
        [version.id, item.trip_id, item.sequence_no, item.description, item.line_amount]
      );
    }

    await createAudit({ entityType: 'BILL', entityId: bill.id, action: 'CREATE', newState: bill, userId }, client);

    const finalBillRes = await client.query('SELECT * FROM bills WHERE id = $1', [bill.id]); return { bill: finalBillRes.rows[0], version };
  });
};

export const checkEligibility = async (data: any) => {
  const tripsParams = data.trip_ids.map((_: any, i: number) => "$" + (i + 2)).join(',');
  const tripsQuery = "SELECT t.id, t.trip_number, t.status, p.pod_received_at, p.pod_status, EXISTS (SELECT 1 FROM bill_items bi JOIN bills b ON bi.bill_id = b.id WHERE bi.trip_id = t.id AND b.bill_status != 'CANCELLED') as has_active_bill FROM trips t LEFT JOIN trip_pods p ON t.id = p.trip_id WHERE t.id IN (" + tripsParams + ") AND t.party_id = $1";
  const { rows } = await query(tripsQuery, [data.party_id, ...data.trip_ids]);
  
  return rows.map(r => ({
    trip_id: r.id,
    trip_number: r.trip_number,
    is_eligible: r.status === 'COMPLETED' && 
                 (r.pod_received_at !== null || ['RECEIVED', 'SENT', 'DISPATCHED'].includes(r.pod_status)) && 
                 !r.has_active_bill,
    status: r.status,
    pod_received: r.pod_received_at !== null || ['RECEIVED', 'SENT', 'DISPATCHED'].includes(r.pod_status),
    has_active_bill: r.has_active_bill
  }));
};

export const listBills = async (filters: any) => {
  let q = 'SELECT * FROM bills WHERE 1=1';
  const params: any[] = [];
  
  if (filters.party_id) {
    params.push(filters.party_id);
    q += ' AND party_id = $' + params.length;
  }
  if (filters.bill_status) {
    params.push(filters.bill_status);
    q += ' AND bill_status = $' + params.length;
  }
  
  q += ' ORDER BY created_at DESC';
  const { rows } = await query(q, params);
  return rows;
};

export const getBill = async (id: string) => {
  const { rows: billRows } = await query('SELECT * FROM bills WHERE id = $1', [id]);
  if (billRows.length === 0) throw new AppError('NOT_FOUND', 'Bill not found', 404);
  
  const { rows: itemRows } = await query('SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY sequence_no ASC', [id]);
  const { rows: versionRows } = await query('SELECT * FROM bill_versions WHERE bill_id = $1 ORDER BY version_number DESC', [id]);
  
  return {
    ...billRows[0],
    items: itemRows,
    versions: versionRows
  };
};

export const submitBill = async (id: string, userId: string) => {
  return withTransaction(async (client) => {
    const { rows } = await client.query("SELECT * FROM bills WHERE id = $1 FOR UPDATE", [id]);
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
    const { rows } = await client.query("SELECT * FROM bills WHERE id = $1 FOR UPDATE", [id]);
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Bill not found', 404);
    
    const bill = rows[0];
    if (['PAID', 'CANCELLED'].includes(bill.bill_status)) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot cancel a paid or already cancelled bill.', 422);
    }
    
    const { rows: updated } = await client.query(
      "UPDATE bills SET bill_status = 'CANCELLED', cancel_reason = $2, cancelled_by = $3, cancelled_at = now(), updated_at = now() WHERE id = $1 RETURNING *",
      [id, cancelReason, userId]
    );
    
    await createAudit({ entityType: 'BILL', entityId: id, action: 'CANCEL', newState: updated[0], userId }, client);
    return updated[0];
  });
};

export const createVersion = async (id: string, data: any, userId: string) => {
  return withTransaction(async (client) => {
    const { rows } = await client.query("SELECT * FROM bills WHERE id = $1 FOR UPDATE", [id]);
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Bill not found', 404);
    const bill = rows[0];
    
    if (bill.bill_status === 'CANCELLED' || bill.bill_status === 'PAID') {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot create versions for cancelled or paid bills.', 422);
    }

    const { rows: versions } = await client.query("SELECT version_number FROM bill_versions WHERE bill_id = $1 ORDER BY version_number DESC LIMIT 1", [id]);
    const nextVersion = (versions[0]?.version_number || 0) + 1;

    await client.query("UPDATE bill_versions SET version_status = 'SUPERSEDED' WHERE bill_id = $1", [id]);

    let snapshot = data.template_snapshot || {};
    if (!snapshot.layout) snapshot.layout = {};
    if (!snapshot.components) snapshot.components = [];
    if (!snapshot.assets) snapshot.assets = [];
    if (!snapshot.dynamic_field_definitions) snapshot.dynamic_field_definitions = [];

    const vQuery = "INSERT INTO bill_versions (bill_id, version_number, version_label, version_status, template_id, template_snapshot, resolved_dynamic_fields, created_by) VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7) RETURNING *";
    const vRes = await client.query(vQuery, [
      bill.id,
      nextVersion,
      'Version ' + nextVersion,
      data.template_id || null,
      snapshot,
      data.resolved_dynamic_fields || {},
      userId
    ]);
    const version = vRes.rows[0];

    const { rows: items } = await client.query("SELECT * FROM bill_items WHERE bill_id = $1", [id]);
    for (const item of items) {
      await client.query(
        "INSERT INTO bill_version_items (bill_version_id, trip_id, sequence_no, description, line_amount) VALUES ($1, $2, $3, $4, $5)",
        [version.id, item.trip_id, item.sequence_no, item.description, item.line_amount]
      );
    }

    await createAudit({ entityType: 'BILL_VERSION', entityId: version.id, action: 'CREATE', newState: version, userId }, client);
    return version;
  });
};
