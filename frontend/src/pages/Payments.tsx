import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Filter, RotateCcw, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { AmountDisplay } from '../components/AmountDisplay';
import { useAuthStore } from '../store/authStore';
import { getPayments, type PaymentListParams } from '../services/api';

export default function Payments() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canRecordPayment = user?.role === 'OWNER' || user?.role === 'STAFF';

  // Filters state
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentType, setPaymentType] = useState<'' | 'INCOMING' | 'OUTGOING'>('');
  const [category, setCategory] = useState('');
  const [paymentMode, setPaymentMode] = useState<'' | 'UPI' | 'BANK_TRANSFER' | 'CASH'>('');
  const [paymentStatus, setPaymentStatus] = useState<'' | 'ACTIVE' | 'REVERSED'>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Query parameters
  const queryParams: PaymentListParams = {
    search: search.trim() || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    payment_type: paymentType || undefined,
    category: category || undefined,
    payment_mode: paymentMode || undefined,
    payment_status: paymentStatus || undefined,
    page,
    limit,
    sort_by: 'payment_date',
    sort_order: 'DESC'
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['payments', queryParams],
    queryFn: () => getPayments(queryParams),
  });

  const handleResetFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setPaymentType('');
    setCategory('');
    setPaymentMode('');
    setPaymentStatus('');
    setPage(1);
  };

  const actions = canRecordPayment ? (
    <Link to="/payments/new">
      <Button className="flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Record Payment
      </Button>
    </Link>
  ) : null;

  const payments = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const formatCategoryName = (cat: string) => {
    return cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatPaymentMode = (mode: string) => {
    switch (mode) {
      case 'UPI': return 'UPI';
      case 'BANK_TRANSFER': return 'Bank Transfer';
      case 'CASH': return 'Cash';
      default: return mode;
    }
  };

  return (
    <PageContainer title="Payments" actions={actions}>
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
              className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Payment ID, Entity..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Direction */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Direction</label>
              <select
                value={paymentType}
                onChange={(e) => { setPaymentType(e.target.value as any); setCategory(''); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Directions</option>
                <option value="INCOMING">Incoming (Receipts)</option>
                <option value="OUTGOING">Outgoing (Payments)</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {(!paymentType || paymentType === 'INCOMING') && (
                  <>
                    <option value="COMPANY_PAYMENT">Company Payment</option>
                    <option value="MARKET_PARTY_PAYMENT">Market Party Payment</option>
                    <option value="OTHER_BUSINESS_RECEIPT">Other Business Receipt</option>
                  </>
                )}
                {(!paymentType || paymentType === 'OUTGOING') && (
                  <>
                    <option value="VEHICLE_OWNER_PAYMENT">Vehicle Owner Payment</option>
                    <option value="OWN_FLEET_EXPENSE">Own Fleet Expense</option>
                    <option value="OTHER_BUSINESS_PAYMENT">Other Business Payment</option>
                  </>
                )}
              </select>
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => { setPaymentMode(e.target.value as any); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Modes</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => { setPaymentStatus(e.target.value as any); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="REVERSED">Reversed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            Loading payments...
          </div>
        ) : isError ? (
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 text-center text-red-600">
            Error loading payments: {(error as any)?.message || 'Failed to fetch payments'}
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500 space-y-3">
            <p className="text-base font-medium">No payments found</p>
            <p className="text-sm text-gray-400">Try adjusting your search criteria or record a new payment.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5 text-left">Payment ID</th>
                    <th className="px-6 py-3.5 text-left">Date</th>
                    <th className="px-6 py-3.5 text-left">Direction</th>
                    <th className="px-6 py-3.5 text-left">Category</th>
                    <th className="px-6 py-3.5 text-left">Entity</th>
                    <th className="px-6 py-3.5 text-right">Amount</th>
                    <th className="px-6 py-3.5 text-left">Mode</th>
                    <th className="px-6 py-3.5 text-left">Status</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {payments.map((p) => {
                    const isIncoming = p.payment_type === 'INCOMING';
                    const isReversed = p.payment_status === 'REVERSED';
                    const entityName = p.party_name || p.vehicle_owner_name || p.other_business_category_name || '-';

                    return (
                      <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-blue-600">
                          <Link to={`/payments/${p.id}`} className="hover:underline">
                            {p.payment_id}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isIncoming ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isIncoming ? (
                              <ArrowDownLeft className="w-3 h-3 text-emerald-700" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-blue-700" />
                            )}
                            {p.payment_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                          {formatCategoryName(p.category)}
                        </td>
                        <td className="px-6 py-4 text-gray-900 font-medium">
                          {entityName}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <AmountDisplay 
                            amount={Number(p.amount)} 
                            className={isReversed ? 'line-through text-gray-400' : isIncoming ? 'text-emerald-700' : 'text-gray-900'} 
                          />
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {formatPaymentMode(p.payment_mode)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isReversed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {p.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/payments/${p.id}`)}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500 hover:text-blue-600" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-gray-200">
              {payments.map((p) => {
                const isIncoming = p.payment_type === 'INCOMING';
                const isReversed = p.payment_status === 'REVERSED';
                const entityName = p.party_name || p.vehicle_owner_name || p.other_business_category_name || '-';

                return (
                  <div key={p.id} className="p-4 space-y-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <Link to={`/payments/${p.id}`} className="font-mono text-sm font-semibold text-blue-600">
                        {p.payment_id}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isReversed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {p.payment_status}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-gray-500">
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '-'}
                      </span>
                      <AmountDisplay 
                        amount={Number(p.amount)} 
                        className={`text-base ${isReversed ? 'line-through text-gray-400' : isIncoming ? 'text-emerald-700' : 'text-gray-900'}`} 
                      />
                    </div>

                    <div className="text-sm font-medium text-gray-800">
                      {entityName}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isIncoming ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {p.payment_type}
                        </span>
                        <span>{formatPaymentMode(p.payment_mode)}</span>
                      </div>
                      <Link to={`/payments/${p.id}`} className="text-blue-600 font-medium hover:underline flex items-center gap-1">
                        View <Eye className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Bar */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-gray-500">
                Showing{' '}
                <span className="font-medium">
                  {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span> payments
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-gray-600 px-2">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
