import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Filter, RotateCcw, Receipt } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { AmountDisplay } from '../components/AmountDisplay';
import { StatusBadge } from '../components/StatusBadge';
import { useAuthStore } from '../store/authStore';
import { 
  getBills, 
  getParties, 
  getFinancialYears,
  type BillListParams 
} from '../services/api';

export default function Bills() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canCreateBill = user?.role === 'OWNER' || user?.role === 'STAFF';

  // Filters state
  const [search, setSearch] = useState('');
  const [partyId, setPartyId] = useState('');
  const [financialYearId, setFinancialYearId] = useState('');
  const [billStatus, setBillStatus] = useState<'' | 'GENERATED' | 'SUBMITTED' | 'PAID' | 'CANCELLED'>('');
  const [billingMode, setBillingMode] = useState<'' | 'INDIVIDUAL' | 'CONSOLIDATED'>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Query parameters for bills
  const queryParams: BillListParams = {
    search: search.trim() || undefined,
    party_id: partyId || undefined,
    financial_year_id: financialYearId || undefined,
    bill_status: billStatus || undefined,
    billing_mode: billingMode || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    page,
    limit,
    sort_by: 'created_at',
    sort_order: 'DESC'
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['bills', queryParams],
    queryFn: () => getBills(queryParams),
  });

  // Query for parties dropdown
  const { data: partiesData } = useQuery({
    queryKey: ['parties'],
    queryFn: () => getParties(),
  });

  // Query for financial years dropdown
  const { data: fyData } = useQuery({
    queryKey: ['financial-years'],
    queryFn: () => getFinancialYears(),
  });

  const handleResetFilters = () => {
    setSearch('');
    setPartyId('');
    setFinancialYearId('');
    setBillStatus('');
    setBillingMode('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const actions = canCreateBill ? (
    <Link to="/bills/new">
      <Button className="flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Create Bill
      </Button>
    </Link>
  ) : null;

  const bills = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const parties = partiesData?.data || [];
  const financialYears = fyData?.data || [];

  return (
    <PageContainer title="Bills" actions={actions}>
      <div className="space-y-6">
        {/* Filters Card */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2 font-medium text-gray-700">
              <Filter className="w-4 h-4 text-gray-500" />
              <span>Filters & Search</span>
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
              aria-label="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label htmlFor="search-input" className="block text-xs font-medium text-gray-600 mb-1">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  id="search-input"
                  type="text"
                  placeholder="Bill No, Party Name..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Party */}
            <div>
              <label htmlFor="party-select" className="block text-xs font-medium text-gray-600 mb-1">Party / Company</label>
              <select
                id="party-select"
                value={partyId}
                onChange={(e) => { setPartyId(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">All Parties</option>
                {parties.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Bill Status */}
            <div>
              <label htmlFor="status-select" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                id="status-select"
                value={billStatus}
                onChange={(e) => { setBillStatus(e.target.value as any); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="GENERATED">Generated</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Financial Year */}
            <div>
              <label htmlFor="fy-select" className="block text-xs font-medium text-gray-600 mb-1">Financial Year</label>
              <select
                id="fy-select"
                value={financialYearId}
                onChange={(e) => { setFinancialYearId(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">All Financial Years</option>
                {financialYears.map((fy: any) => (
                  <option key={fy.id} value={fy.id}>{fy.code}</option>
                ))}
              </select>
            </div>

            {/* Billing Mode */}
            <div>
              <label htmlFor="mode-select" className="block text-xs font-medium text-gray-600 mb-1">Billing Mode</label>
              <select
                id="mode-select"
                value={billingMode}
                onChange={(e) => { setBillingMode(e.target.value as any); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">All Modes</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="CONSOLIDATED">Consolidated</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label htmlFor="from-date-input" className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
              <input
                id="from-date-input"
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* To Date */}
            <div>
              <label htmlFor="to-date-input" className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
              <input
                id="to-date-input"
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="bg-white p-12 text-center border border-gray-200 rounded-lg shadow-sm" role="status">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading bills...</p>
          </div>
        ) : isError ? (
          <div className="bg-red-50 p-6 rounded-lg border border-red-200 text-center">
            <p className="text-red-700 text-sm font-medium">Failed to load bills</p>
            <p className="text-red-600 text-xs mt-1">{(error as any)?.message || 'An unexpected error occurred.'}</p>
            <Button variant="secondary" onClick={() => refetch()} className="mt-4 text-xs">
              Retry
            </Button>
          </div>
        ) : bills.length === 0 ? (
          <div className="bg-white p-12 text-center border border-gray-200 rounded-lg shadow-sm space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-base font-medium text-gray-800">No bills found</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              No bills match your current filter criteria or none have been generated yet.
            </p>
            {canCreateBill && (
              <div className="pt-2">
                <Link to="/bills/new">
                  <Button className="text-xs">Create First Bill</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-medium">
                    <tr>
                      <th className="px-4 py-3">Bill No.</th>
                      <th className="px-4 py-3">Party</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">FY</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Version</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bills.map((bill) => (
                      <tr 
                        key={bill.id} 
                        className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                        onClick={() => navigate(`/bills/${bill.id}`)}
                      >
                        <td className="px-4 py-3 font-semibold text-blue-600">
                          {bill.bill_number}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate" title={bill.party_name}>
                          {bill.party_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {bill.bill_date}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-mono">
                            {bill.financial_year_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {bill.billing_mode === 'CONSOLIDATED' ? 'Consolidated' : 'Individual'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                          v{bill.current_version}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          <AmountDisplay amount={bill.total_amount} />
                        </td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">
                          <AmountDisplay amount={bill.paid_amount} />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">
                          <AmountDisplay amount={bill.balance_amount} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={bill.bill_status} />
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Link 
                            to={`/bills/${bill.id}`} 
                            className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="View details"
                            aria-label={`View bill ${bill.bill_number}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {bills.map((bill) => (
                <div 
                  key={bill.id} 
                  onClick={() => navigate(`/bills/${bill.id}`)}
                  className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3 cursor-pointer hover:border-blue-300"
                >
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-blue-600 text-sm">{bill.bill_number}</span>
                      <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                        v{bill.current_version}
                      </span>
                    </div>
                    <StatusBadge status={bill.bill_status} />
                  </div>

                  <div>
                    <div className="font-medium text-gray-900 text-sm">{bill.party_name}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{bill.bill_date}</span>
                      <span>•</span>
                      <span>{bill.financial_year_code}</span>
                      <span>•</span>
                      <span>{bill.billing_mode}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded border border-gray-100 text-center text-xs">
                    <div>
                      <div className="text-gray-500">Total</div>
                      <div className="font-medium mt-0.5"><AmountDisplay amount={bill.total_amount} /></div>
                    </div>
                    <div>
                      <div className="text-gray-500">Paid</div>
                      <div className="font-medium text-green-700 mt-0.5"><AmountDisplay amount={bill.paid_amount} /></div>
                    </div>
                    <div>
                      <div className="text-gray-500">Balance</div>
                      <div className="font-medium mt-0.5"><AmountDisplay amount={bill.balance_amount} /></div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button variant="ghost" className="text-xs text-blue-600 p-1 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border border-gray-200 rounded-lg shadow-sm text-sm">
                <div className="text-gray-500 text-xs">
                  Showing Page <span className="font-medium text-gray-800">{pagination.page}</span> of{' '}
                  <span className="font-medium text-gray-800">{pagination.totalPages}</span> ({pagination.total} bills total)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="text-xs py-1.5 px-3"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    className="text-xs py-1.5 px-3"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
