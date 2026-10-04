import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { PageContainer } from '../components/PageContainer';
import { AmountDisplay } from '../components/AmountDisplay';
import { StatusBadge, type StatusType } from '../components/StatusBadge';
import { Input } from '../components/Input';

interface DashboardData {
  header: {
    user: { id: string; name: string; role: string };
  };
  businessSnapshot: {
    totalTrips: number;
    ownFleetTrips: number;
    financialSummary: {
      totalIncoming: number;
      totalOutgoing: number;
      netPnl: number;
    };
  };
  needsAttention: {
    pendingPodTrips: number;
    unpaidBills: number;
  };
  recentTrips: Array<{
    id: string;
    trip_number: string;
    trip_date: string;
    status: string;
  }>;
  recentPayments: Array<{
    id: string;
    payment_date: string;
    payment_type: string;
    amount: string | number;
    payment_status: string;
    payment_mode: string;
  }>;
}

const fetchDashboardData = async (fromDate: string, toDate: string): Promise<DashboardData> => {
  const params: Record<string, string> = {};
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;
  const { data } = await api.get('/api/dashboard', { params });
  return data.data;
};

const getTripStatusType = (status: string): StatusType => {
  switch (status) {
    case 'COMPLETED':
    case 'BILLED':
      return 'success';
    case 'PENDING_POD':
    case 'ACTIVE':
      return 'warning';
    case 'CANCELLED':
      return 'error';
    default:
      return 'info';
  }
};

const getPaymentStatusType = (status: string): StatusType => {
  switch (status) {
    case 'ACTIVE':
    case 'COMPLETED':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'CANCELLED':
    case 'FAILED':
      return 'error';
    default:
      return 'info';
  }
};

export const DashboardPage: React.FC = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', fromDate, toDate],
    queryFn: () => fetchDashboardData(fromDate, toDate),
  });

  const actions = (
    <div className="flex gap-4">
      <Input
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
        className="w-auto"
        placeholder="From Date"
      />
      <Input
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
        className="w-auto"
        placeholder="To Date"
      />
    </div>
  );

  return (
    <PageContainer title="Dashboard" actions={actions}>
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-gray-500">Loading dashboard...</div>
        </div>
      ) : isError ? (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded">
          Error loading dashboard data: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Business Snapshot */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Snapshot</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded shadow border border-gray-100">
                <div className="text-sm text-gray-500 mb-1">Total Trips</div>
                <div className="text-2xl font-bold">{data.businessSnapshot.totalTrips}</div>
              </div>
              <div className="bg-white p-4 rounded shadow border border-gray-100">
                <div className="text-sm text-gray-500 mb-1">Total Receivables</div>
                <div className="text-2xl font-bold text-gray-900">
                  <AmountDisplay amount={Number(data.businessSnapshot.financialSummary.totalIncoming)} />
                </div>
              </div>
              <div className="bg-white p-4 rounded shadow border border-gray-100">
                <div className="text-sm text-gray-500 mb-1">Total Payables</div>
                <div className="text-2xl font-bold text-gray-900">
                  <AmountDisplay amount={Number(data.businessSnapshot.financialSummary.totalOutgoing)} />
                </div>
              </div>
              <div className="bg-white p-4 rounded shadow border border-gray-100">
                <div className="text-sm text-gray-500 mb-1">Net P&L</div>
                <div className="text-2xl font-bold">
                  <AmountDisplay amount={Number(data.businessSnapshot.financialSummary.netPnl)} />
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Needs Attention */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Needs Attention</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  to="/trips"
                  className="block bg-orange-50 p-4 rounded shadow-sm border border-orange-100 hover:bg-orange-100 transition-colors"
                >
                  <div className="text-sm text-orange-800 mb-1 font-medium">Pending PODs</div>
                  <div className="text-2xl font-bold text-orange-900">
                    {data.needsAttention.pendingPodTrips}
                  </div>
                </Link>
                <Link
                  to="/bills"
                  className="block bg-red-50 p-4 rounded shadow-sm border border-red-100 hover:bg-red-100 transition-colors"
                >
                  <div className="text-sm text-red-800 mb-1 font-medium">Unpaid Bills</div>
                  <div className="text-2xl font-bold text-red-900">
                    {data.needsAttention.unpaidBills}
                  </div>
                </Link>
              </div>
            </section>

            {/* Own Fleet Performance */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Own Fleet Performance</h2>
              <div className="bg-blue-50 p-4 rounded shadow-sm border border-blue-100 h-[106px] flex flex-col justify-center">
                <div className="text-sm text-blue-800 mb-1 font-medium">Total Own Fleet Trips</div>
                <div className="text-2xl font-bold text-blue-900">
                  {data.businessSnapshot.ownFleetTrips}
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trip Activity */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Trips</h2>
              <div className="bg-white rounded shadow overflow-hidden border border-gray-100">
                {data.recentTrips.length === 0 ? (
                  <div className="p-4 text-gray-500 text-center">No recent trips.</div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Trip No
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.recentTrips.map((trip) => (
                        <tr key={trip.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {trip.trip_number}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {trip.trip_date ? new Date(trip.trip_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              status={getTripStatusType(trip.status)}
                              label={trip.status}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Recent Payments */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h2>
              <div className="bg-white rounded shadow overflow-hidden border border-gray-100">
                {data.recentPayments.length === 0 ? (
                  <div className="p-4 text-gray-500 text-center">No recent payments.</div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.recentPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500">
                            {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {payment.payment_type}
                          </td>
                          <td className="px-4 py-3">
                            <AmountDisplay amount={Number(payment.amount)} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              status={getPaymentStatusType(payment.payment_status)}
                              label={payment.payment_status}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default DashboardPage;
