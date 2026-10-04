import { pool } from '../../db';
import { getFinancialSummary } from '../reports/reports.service';

export const getDashboardData = async (user: any, query: any) => {
  const { fromDate, toDate } = query;
  
  // Base date filter
  const dateValues: any[] = [];
  let dateCondition = '';
  if (fromDate && toDate) {
    dateCondition = ` AND created_at >= $1 AND created_at <= $2`;
    dateValues.push(fromDate, toDate);
  }

  // 1. Business snapshot / Financial position
  // Use existing report service for financial summary
  let financialSummary = { totalIncoming: 0, totalOutgoing: 0, netPnl: 0 };
  try {
    financialSummary = await getFinancialSummary(query);
  } catch (e) {
    // Ignore if not implemented fully or if fails
  }

  // Trip stats
  let tripValues: any[] = [];
  let tripDateCondition = '';
  if (fromDate && toDate) {
    tripDateCondition = ` AND trip_date >= $1 AND trip_date <= $2`;
    tripValues.push(fromDate, toDate);
  }

  const tripsCount = await pool.query(`SELECT COUNT(*) FROM trips WHERE status != 'CANCELLED' ${tripDateCondition}`, tripValues);
  
  // Needs attention
  const pendingTrips = await pool.query(`SELECT COUNT(*) FROM trips WHERE status = 'PENDING_POD'`);
  const unpaidBills = await pool.query(`SELECT COUNT(*) FROM bills WHERE bill_status IN ('UNPAID', 'PARTIALLY_PAID')`);

  // Recent trips
  const recentTrips = await pool.query(`
    SELECT id, trip_number, trip_date, status
    FROM trips
    ORDER BY created_at DESC
    LIMIT 5
  `);

  // Recent payments
  const recentPayments = await pool.query(`
    SELECT id, payment_date, payment_type, amount, payment_status, payment_mode
    FROM payments
    WHERE payment_status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  // Own-fleet performance (simple count or expense sum)
  const ownFleetTrips = await pool.query(`
    SELECT COUNT(*) FROM trips 
    WHERE ownership_type = 'OWN_FLEET' AND status != 'CANCELLED'
    ${tripDateCondition}
  `, tripValues);

  return {
    header: {
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    },
    businessSnapshot: {
      totalTrips: parseInt(tripsCount.rows[0].count, 10) || 0,
      ownFleetTrips: parseInt(ownFleetTrips.rows[0].count, 10) || 0,
      financialSummary
    },
    needsAttention: {
      pendingPodTrips: parseInt(pendingTrips.rows[0].count, 10) || 0,
      unpaidBills: parseInt(unpaidBills.rows[0].count, 10) || 0
    },
    recentTrips: recentTrips.rows,
    recentPayments: recentPayments.rows
  };
};
