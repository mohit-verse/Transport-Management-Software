import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, Save, Info } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { AmountDisplay } from '../components/AmountDisplay';
import { getPayment, updatePayment } from '../services/api';

export default function EditPayment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');
  const [errorMessage, setErrorMessage] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => getPayment(id!),
    enabled: !!id,
  });

  const payment = data?.data;

  useEffect(() => {
    if (payment) {
      if (payment.payment_date) {
        setPaymentDate(new Date(payment.payment_date).toISOString().split('T')[0]);
      }
      if (payment.payment_mode) {
        setPaymentMode(payment.payment_mode);
      }
    }
  }, [payment]);

  const updateMutation = useMutation({
    mutationFn: (payload: { payment_date?: string; payment_mode?: 'UPI' | 'BANK_TRANSFER' | 'CASH' }) =>
      updatePayment(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      navigate(`/payments/${id}`);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to update payment');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!paymentDate) {
      setErrorMessage('Payment date is required.');
      return;
    }
    updateMutation.mutate({
      payment_date: paymentDate,
      payment_mode: paymentMode
    });
  };

  if (isLoading) {
    return (
      <PageContainer title="Edit Payment">
        <div className="bg-white p-12 text-center text-gray-500 rounded-lg border border-gray-200">
          Loading payment details...
        </div>
      </PageContainer>
    );
  }

  if (isError || !payment) {
    return (
      <PageContainer title="Edit Payment">
        <div className="bg-white p-12 text-center text-red-600 rounded-lg border border-red-200 space-y-4">
          <p className="font-semibold text-lg">Error loading payment</p>
          <p className="text-sm text-gray-500">{(error as any)?.message || 'Payment not found'}</p>
          <Button variant="secondary" onClick={() => navigate('/payments')}>
            Back to Payments
          </Button>
        </div>
      </PageContainer>
    );
  }

  const isReversed = payment.payment_status === 'REVERSED';
  const entityName = payment.party_name || payment.vehicle_owner_name || payment.other_business_category_name || '-';

  return (
    <PageContainer
      title={`Edit Payment ${payment.payment_id}`}
      actions={
        <Button variant="secondary" onClick={() => navigate(`/payments/${id}`)} className="flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to Details
        </Button>
      }
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Reversal Guard Banner */}
        {isReversed && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-red-900">Editing Prohibited</h3>
              <p className="text-xs text-red-800">
                This payment was reversed and cannot be edited. Its allocations and financial records are permanent historical audit items.
              </p>
            </div>
          </div>
        )}

        {/* Informational Guidance */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 text-xs text-blue-800">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            Under SSRL single source-of-truth rules, only operational metadata (<span className="font-semibold">Payment Date</span> and <span className="font-semibold">Payment Mode</span>) can be modified here. To redistribute funds across documents, use <span className="font-semibold">Reallocation</span> (Owner only). To change the total amount, reverse this payment and record a new one.
          </p>
        </div>

        {/* Read-Only Summary Card */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b pb-2">
            Locked Financial Fields
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500 block">Payment ID</span>
              <span className="font-mono font-semibold text-gray-900">{payment.payment_id}</span>
            </div>

            <div>
              <span className="text-gray-500 block">Status</span>
              <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${
                isReversed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}>
                {payment.payment_status}
              </span>
            </div>

            <div>
              <span className="text-gray-500 block">Direction & Category</span>
              <span className="font-medium text-gray-900">
                {payment.payment_type} — {payment.category.replace(/_/g, ' ')}
              </span>
            </div>

            <div>
              <span className="text-gray-500 block">Associated Entity</span>
              <span className="font-medium text-gray-900">{entityName}</span>
            </div>

            <div className="col-span-2 pt-2 border-t">
              <span className="text-gray-500 block">Amount (Locked)</span>
              <AmountDisplay amount={Number(payment.amount)} className="text-xl font-bold text-gray-900" />
            </div>
          </div>
        </div>

        {/* Editable Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b pb-2">
            Editable Metadata
          </h3>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="payment-date" className="block text-xs font-semibold text-gray-700 mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                id="payment-date"
                type="date"
                value={paymentDate}
                disabled={isReversed || updateMutation.isPending}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                required
              />
            </div>

            <div>
              <label htmlFor="payment-mode" className="block text-xs font-semibold text-gray-700 mb-1">
                Payment Mode <span className="text-red-500">*</span>
              </label>
              <select
                id="payment-mode"
                value={paymentMode}
                disabled={isReversed || updateMutation.isPending}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                required
              >
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/payments/${id}`)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isReversed || updateMutation.isPending}
              className="flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
