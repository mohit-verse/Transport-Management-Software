
import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';

export const createTrip = async (data: any, userId: string) => {
  return withTransaction(async (client) => {
    // Basic relationship checks (db triggers will enforce this but good practice)
    if (data.vehicle_relationship === 'MARKET') {
      if (!data.market_vehicle_id || !data.vehicle_owner_id) throw new AppError('BUSINESS_RULE_VIOLATION', 'Market trip requires market vehicle and owner.', 422);
    } else {
      if (!data.own_fleet_vehicle_id) throw new AppError('BUSINESS_RULE_VIOLATION', 'Own fleet trip requires own fleet vehicle.', 422);
    }

    const tSql = `
      INSERT INTO trips (trip_type, vehicle_relationship, party_id, vehicle_owner_id, market_vehicle_id, own_fleet_vehicle_id, driver_name, driver_mobile, trip_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `;
    const tParams = [data.trip_type, data.vehicle_relationship, data.party_id, data.vehicle_owner_id || null, data.market_vehicle_id || null, data.own_fleet_vehicle_id || null, data.driver_name, data.driver_mobile, data.trip_date];
    const res = await client.query(tSql, tParams);
    const trip = res.rows[0];

    let destOrder = 1;
    for (const d of data.destinations) {
      await client.query('INSERT INTO trip_destinations (trip_id, destination_order, origin, destination) VALUES ($1, $2, $3, $4)', [trip.id, destOrder++, d.origin, d.destination]);
    }

    // Initialize financials
    await client.query('INSERT INTO trip_party_financials (trip_id) VALUES ($1)', [trip.id]);
    if (data.vehicle_relationship === 'MARKET') {
      await client.query('INSERT INTO trip_vehicle_owner_financials (trip_id) VALUES ($1)', [trip.id]);
    }

    // Initialize POD
    await client.query('INSERT INTO trip_pods (trip_id) VALUES ($1)', [trip.id]);

    await createAudit({ entityType: 'TRIP', entityId: trip.id, action: 'CREATE', newState: trip, userId }, client);
    return trip;
  });
};

export const getTripById = async (id: string) => {
  const tripRes = await query(`
    SELECT t.*, 
      p.name as party_name,
      mv.vehicle_number as market_vehicle_number,
      vo.owner_name as vehicle_owner_name,
      ofv.vehicle_number as own_fleet_vehicle_number
    FROM trips t
    LEFT JOIN parties p ON t.party_id = p.id
    LEFT JOIN market_vehicles mv ON t.market_vehicle_id = mv.id
    LEFT JOIN vehicle_owners vo ON t.vehicle_owner_id = vo.id
    LEFT JOIN own_fleet_vehicles ofv ON t.own_fleet_vehicle_id = ofv.id
    WHERE t.id = $1
  `, [id]);

  if (tripRes.rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Trip not found', 404);
  }
  const trip = tripRes.rows[0];

  const destinationsRes = await query('SELECT * FROM trip_destinations WHERE trip_id = $1 ORDER BY sequence_no ASC', [id]);
  const partyFinancialsRes = await query('SELECT * FROM trip_party_financials WHERE trip_id = $1', [id]);
  const ownerFinancialsRes = await query('SELECT * FROM trip_vehicle_owner_financials WHERE trip_id = $1', [id]);
  const otherChargesRes = await query('SELECT * FROM trip_other_charges WHERE trip_id = $1', [id]);
  const deductionsRes = await query('SELECT * FROM trip_deductions WHERE trip_id = $1', [id]);
  const unloadingChargesRes = await query('SELECT * FROM trip_unloading_charges WHERE trip_id = $1', [id]);
  
  const podRes = await query('SELECT * FROM trip_pods WHERE trip_id = $1', [id]);
  const issuesRes = await query('SELECT * FROM trip_issues WHERE trip_id = $1', [id]);

  const billsRes = await query(`
    SELECT DISTINCT b.*
    FROM bills b
    JOIN bill_items bi ON b.id = bi.bill_id
    WHERE bi.trip_id = $1
  `, [id]);

  const paymentsRes = await query(`
    SELECT p.*, pa.allocation_amount, pa.allocation_type 
    FROM payments p
    JOIN payment_allocations pa ON p.id = pa.payment_id
    WHERE pa.trip_id = $1
  `, [id]);

  const documentsRes = await query(`
    SELECT d.*, dl.link_type
    FROM documents d
    JOIN document_links dl ON d.id = dl.document_id
    WHERE dl.entity_type = 'TRIP' AND dl.entity_id = $1
  `, [id]);

  return {
    ...trip,
    party: trip.party_id ? { id: trip.party_id, name: trip.party_name } : null,
    market_vehicle: trip.market_vehicle_id ? { id: trip.market_vehicle_id, vehicle_number: trip.market_vehicle_number } : null,
    vehicle_owner: trip.vehicle_owner_id ? { id: trip.vehicle_owner_id, owner_name: trip.vehicle_owner_name } : null,
    own_fleet_vehicle: trip.own_fleet_vehicle_id ? { id: trip.own_fleet_vehicle_id, vehicle_number: trip.own_fleet_vehicle_number } : null,
    destinations: destinationsRes.rows,
    financials: {
      party: partyFinancialsRes.rows[0] || null,
      vehicle_owner: ownerFinancialsRes.rows[0] || null,
      other_charges: otherChargesRes.rows,
      deductions: deductionsRes.rows,
      unloading_charges: unloadingChargesRes.rows
    },
    pod: podRes.rows[0] || null,
    issues: issuesRes.rows,
    bills: billsRes.rows,
    payments: paymentsRes.rows,
    documents: documentsRes.rows
  };
};

export const getTrips = async () => {
  const res = await query('SELECT * FROM trips ORDER BY created_at DESC');
  return res.rows;
};

export const updateCoreTrip = async (id: string, data: any, userId: string) => {
  return withTransaction(async (client) => {
    const tripRes = await client.query('SELECT * FROM trips WHERE id = $1', [id]);
    if (tripRes.rows.length === 0) throw new AppError('NOT_FOUND', 'Trip not found', 404);
    const oldTrip = tripRes.rows[0];

    const updates: string[] = [];
    const values: any[] = [];
    const allowedFields = [
      'driver_mobile_number', 'lr_number', 'invoice_number', 'trip_date',
      'loading_date', 'unloading_date', 'origin', 'destination'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        values.push(data[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    let updatedTrip = oldTrip;
    if (updates.length > 0) {
      values.push(id);
      const updateQuery = `UPDATE trips SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
      const res = await client.query(updateQuery, values);
      updatedTrip = res.rows[0];
    }

    if (data.destinations && Array.isArray(data.destinations)) {
      const existingDests = await client.query('SELECT * FROM trip_destinations WHERE trip_id = $1', [id]);
      const existingIds = existingDests.rows.map(r => r.id);
      
      const newDests = data.destinations;
      const newIds = newDests.filter((d: any) => d.id).map((d: any) => d.id);

      const toDelete = existingIds.filter(id => !newIds.includes(id));
      for (const destId of toDelete) {
        try {
          await client.query('DELETE FROM trip_destinations WHERE id = $1', [destId]);
        } catch (error: any) {
          if (error.code === '23503') {
            throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot remove destination with linked financial records', 400);
          }
          throw error;
        }
      }

      for (let i = 0; i < newDests.length; i++) {
        const dest = newDests[i];
        const seq = i + 1;
        if (dest.id) {
          await client.query(
            'UPDATE trip_destinations SET sequence_no = $1, from_location = $2, to_location = $3, distance_km = $4 WHERE id = $5',
            [seq, dest.from_location, dest.to_location, dest.distance_km || null, dest.id]
          );
        } else {
          await client.query(
            'INSERT INTO trip_destinations (trip_id, sequence_no, from_location, to_location, distance_km) VALUES ($1, $2, $3, $4, $5)',
            [id, seq, dest.from_location, dest.to_location, dest.distance_km || null]
          );
        }
      }
    }

    await createAudit({ entityType: 'TRIP', entityId: id, action: 'UPDATE_CORE', newState: updatedTrip, userId }, client);
    return updatedTrip;
  });
};

export const updateStatus = async (id: string, status: string, userId: string) => {
  const res = await query('UPDATE trips SET trip_status = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, status]);
  if (res.rows.length === 0) throw new AppError('NOT_FOUND', 'Trip not found', 404);
  await createAudit({ entityType: 'TRIP', entityId: id, action: 'STATUS_UPDATE', newState: res.rows[0], userId });
  return res.rows[0];
};

export const updateFinancials = async (id: string, data: any, userId: string) => {
  return withTransaction(async (client) => {
    // Check if trip exists
    const t = await client.query('SELECT * FROM trips WHERE id = $1', [id]);
    if (t.rows.length === 0) throw new AppError('NOT_FOUND', 'Trip not found', 404);
    const trip = t.rows[0];

    // Update Party Financials
    const pSet = [];
    const pVals = [];
    if (data.freight_amount !== undefined) { pVals.push(data.freight_amount); pSet.push(`freight_amount = $${pVals.length}`); }
    if (data.detention_amount !== undefined) { pVals.push(data.detention_amount); pSet.push(`detention_amount = $${pVals.length}`); }
    if (data.tds_amount !== undefined) { pVals.push(data.tds_amount); pSet.push(`tds_amount = $${pVals.length}`); }
    
    if (pSet.length > 0) {
      pVals.push(id);
      await client.query(`UPDATE trip_party_financials SET ${pSet.join(', ')}, updated_at = NOW() WHERE trip_id = $${pVals.length}`, pVals);
    }

    if (data.other_charges) {
      await client.query('DELETE FROM trip_other_charges WHERE trip_id = $1', [id]);
      for (const charge of data.other_charges) {
        await client.query('INSERT INTO trip_other_charges (trip_id, charge_name, amount) VALUES ($1, $2, $3)', [id, charge.charge_name, charge.amount]);
      }
    }

    // (Similar logic for deductions and unloading charges could be added here)

    await createAudit({ entityType: 'TRIP', entityId: id, action: 'FINANCIAL_UPDATE', userId }, client);
    return { success: true };
  });
};

export const createIssue = async (id: string, data: any, userId: string) => {
  const sql = 'INSERT INTO trip_issues (trip_id, issue_type, description) VALUES ($1, $2, $3) RETURNING *';
  const res = await query(sql, [id, data.issue_type, data.description]);
  await createAudit({ entityType: 'TRIP_ISSUE', entityId: res.rows[0].id, action: 'CREATE', newState: res.rows[0], userId });
  return res.rows[0];
};
