import { pool } from '../../db';

export const globalSearch = async (user: any, q: string) => {
  if (!q || q.trim().length === 0) {
    return {
      trips: [],
      parties: [],
      vehicles: [],
      owners: [],
      bills: [],
      payments: []
    };
  }

  const searchTerm = `%${q}%`;
  
  // Trips
  const trips = await pool.query(`
    SELECT id, trip_number, trip_date, status 
    FROM trips 
    WHERE trip_number ILIKE $1 OR route_origin ILIKE $1 OR route_destination ILIKE $1
    LIMIT 10
  `, [searchTerm]);

  // Parties
  const parties = await pool.query(`
    SELECT id, name, contact_person, mobile_number, party_type 
    FROM parties 
    WHERE name ILIKE $1 OR contact_person ILIKE $1 OR mobile_number ILIKE $1 OR pan_number ILIKE $1 OR gst_number ILIKE $1
    LIMIT 10
  `, [searchTerm]);

  // Vehicles (Own and Market)
  const ownVehicles = await pool.query(`
    SELECT id, vehicle_number, 'OWN' as type 
    FROM own_fleet_vehicles 
    WHERE vehicle_number ILIKE $1
    LIMIT 5
  `, [searchTerm]);

  const marketVehicles = await pool.query(`
    SELECT id, vehicle_number, 'MARKET' as type 
    FROM market_vehicles 
    WHERE vehicle_number ILIKE $1
    LIMIT 5
  `, [searchTerm]);

  // Owners
  const owners = await pool.query(`
    SELECT id, name, mobile_number, pan_number 
    FROM vehicle_owners 
    WHERE name ILIKE $1 OR mobile_number ILIKE $1 OR pan_number ILIKE $1
    LIMIT 10
  `, [searchTerm]);

  // Bills
  const bills = await pool.query(`
    SELECT id, bill_number, bill_date, bill_status 
    FROM bills 
    WHERE bill_number ILIKE $1
    LIMIT 10
  `, [searchTerm]);

  // Payments (search by ID or related entities? Let's search by ID or category for now, or maybe amount if it's numeric?)
  // Using CAST to text to search payment_id or amount? Actually just checking category or mode for text.
  const payments = await pool.query(`
    SELECT id, payment_date, payment_type, amount, payment_mode 
    FROM payments 
    WHERE category ILIKE $1 OR payment_mode ILIKE $1
    LIMIT 10
  `, [searchTerm]);

  return {
    trips: trips.rows,
    parties: parties.rows,
    vehicles: [...ownVehicles.rows, ...marketVehicles.rows],
    owners: owners.rows,
    bills: bills.rows,
    payments: payments.rows
  };
};
