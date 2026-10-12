import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Edit2, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Download, 
  Upload, 
  History, 
  ArrowDownLeft, 
  ArrowUpRight,
  Layers,
  FileCheck
} from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { AmountDisplay } from '../components/AmountDisplay';
import { useAuthStore } from '../store/authStore';
import { 
  getPayment, 
  reversePayment, 
  reallocatePayment, 
  uploadPaymentDocument,
  type PaymentAllocation
} from '../services/api';

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const isOwner = user?.role === 'OWNER';
  const isStaff = user?.role === 'STAFF';
  const canEdit = (isOwner || isStaff);

  // Modals state
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [reverseError, setReverseError] = useState('');

  const [showReallocateModal, setShowReallocateModal] = useState(false);
  const [reallocateReason, setReallocateReason] = useState('');
  const [reallocateAllocations, setReallocateAllocations] = useState<Array<{
    allocation_type: any;
    allocated_amount: number;
    target_bill_id?: string;
    target_trip_id?: string;
    target_vehicle_owner_id?: string;
    target_own_fleet_expense_detail_id?: string;
  }>>([]);
  const [reallocateError, setReallocateError] = useState('');

  const [uploadSuccess, setUploadSuccess] = useState('');

  // Fetch payment detail
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => getPayment(id!),
    enabled: !!id,
  });

  const payment = data?.data;

  // Reverse mutation
  const reverseMutation = useMutation({
    mutationFn: (reason: string) => reversePayment(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setShowReverseModal(false);
      setReversalReason('');
      setReverseError('');
    },
    onError: (err: any) => {
      setReverseError(err?.response?.data?.message || err?.message || 'Failed to reverse payment');
    }
  });

  // Reallocate mutation
  const reallocateMutation = useMutation({
    mutationFn: (payload: { allocations: any[]; reason?: string }) => reallocatePayment(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setShowReallocateModal(false);
      setReallocateError('');
    },
    onError: (err: any) => {
      setReallocateError(err?.response?.data?.message || err?.message || 'Failed to reallocate payment');
    }
  });

  // Document upload mutation
  const uploadDocMutation = useMutation({
    mutationFn: (docType: string) => uploadPaymentDocument(id!, docType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      setUploadSuccess('Payment receipt document attached successfully.');
      setTimeout(() => setUploadSuccess(''), 4000);
    }
  });

  const handleOpenReverse = () => {
    setReversalReason('');
    setReverseError('');
    setShowReverseModal(true);
  };

  const handleConfirmReverse = () => {
    if (reversalReason.trim().length < 5) {
      setReverseError('Reversal reason must be at least 5 characters long.');
      return;
    }
    reverseMutation.mutate(reversalReason.trim());
  };

  const handleOpenReallocate = () => {
    if (!payment) return;
    // Pre-populate with existing active allocations structure
    const initial = (payment.allocations || [])
      .filter((a) => a.allocation_status === 'ACTIVE')
      .map((a) => ({
        allocation_type: a.allocation_type,
        allocated_amount: Number(a.allocation_amount),
        target_bill_id: a.bill_id || undefined,
        target_trip_id: a.trip_id || undefined,
        target_vehicle_owner_id: a.vehicle_owner_id || undefined,
        target_own_fleet_expense_detail_id: a.own_fleet_expense_detail_id || undefined
      }));
    setReallocateAllocations(initial.length > 0 ? initial : [
      { allocation_type: payment.payment_type === 'INCOMING' ? 'CREDIT_GENERATED' : 'OTHER_BUSINESS', allocated_amount: Number(payment.amount) }
    ]);
    setReallocateReason('');
    setReallocateError('');
    setShowReallocateModal(true);
  };

  const handleReallocateChange = (index: number, field: string, value: any) => {
    const updated = [...reallocateAllocations];
    updated[index] = { ...updated[index], [field]: value };
    setReallocateAllocations(updated);
  };

  const handleAddReallocateRow = () => {
    setReallocateAllocations([
      ...reallocateAllocations,
      { allocation_type: payment?.payment_type === 'INCOMING' ? 'CREDIT_GENERATED' : 'OTHER_BUSINESS', allocated_amount: 0 }
    ]);
  };

  const handleRemoveReallocateRow = (index: number) => {
    setReallocateAllocations(reallocateAllocations.filter((_, idx) => idx !== index));
  };

  const handleConfirmReallocate = () => {
    if (!payment) return;
    const total = reallocateAllocations.reduce((sum, a) => sum + (Number(a.allocated_amount) || 0), 0);
    const expected = Number(payment.amount);
    if (Math.abs(total - expected) > 0.01) {
      setReallocateError(`Total allocated (₹${total.toFixed(2)}) must exactly match payment amount (₹${expected.toFixed(2)}).`);
      return;
    }
    reallocateMutation.mutate({
      allocations: reallocateAllocations,
      reason: reallocateReason.trim() || undefined
    });
  };

  if (isLoading) {
    return (
      <PageContainer title="Payment Details">
        <div className="bg-white p-12 text-center text-gray-500 rounded-lg border border-gray-200">
          Loading payment details...
        </div>
      </PageContainer>
    );
  }

  if (isError || !payment) {
    return (
      <PageContainer title="Payment Details">
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
  const isIncoming = payment.payment_type === 'INCOMING';
  const totalAllocated = (payment.allocations || [])
    .filter((a) => a.allocation_status === 'ACTIVE')
    .reduce((sum, a) => sum + Number(a.allocation_amount), 0);

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

  const formatAllocationType = (type: string) => {
    switch (type) {
      case 'BILL': return 'Bill Payment';
      case 'TRIP': return 'Trip Freight';
      case 'CREDIT_GENERATED': return 'Party Credit Generated';
      case 'CREDIT_UTILIZED': return 'Party Credit Utilized';
      case 'VEHICLE_OWNER': return 'Vehicle Owner Freight';
      case 'OWN_FLEET_EXPENSE': return 'Own Fleet Expense';
      case 'OTHER_BUSINESS': return 'Other Business';
      default: return type;
    }
  };

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => navigate('/payments')} className="flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>

      {!isReversed && canEdit && (
        <Link to={`/payments/${id}/edit`}>
          <Button variant="secondary" className="flex items-center gap-1.5">
            <Edit2 className="w-4 h-4" />
            Edit
          </Button>
        </Link>
      )}

      {!isReversed && isOwner && (
        <Button variant="secondary" onClick={handleOpenReallocate} className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-600" />
          Reallocate
        </Button>
      )}

      {!isReversed && isOwner && (
        <Button variant="danger" onClick={handleOpenReverse} className="flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4" />
          Reverse Payment
        </Button>
      )}
    </div>
  );

  return (
    <PageContainer title={`Payment ${payment.payment_id}`} actions={actions}>
      <div className="space-y-6">
        {/* Reversal Banner if reversed */}
        {isReversed && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-5 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-red-900">Payment Reversed</h3>
              <p className="text-sm text-red-800">
                This payment was permanently reversed by{' '}
                <span className="font-semibold">{payment.reverser_name || payment.reversed_by || 'Owner'}</span> on{' '}
                <span className="font-semibold">
                  {payment.reversed_at ? new Date(payment.reversed_at).toLocaleString('en-IN') : '-'}
                </span>.
              </p>
              {payment.reversal_reason && (
                <p className="text-sm text-red-700 bg-red-100/60 p-2.5 rounded mt-2 border border-red-200">
                  <span className="font-medium">Reason:</span> {payment.reversal_reason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Upload success notification */}
        {uploadSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-sm text-green-800">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Top Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Financial Card */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Amount</span>
                <div className="mt-1">
                  <AmountDisplay 
                    amount={Number(payment.amount)} 
                    className={`text-3xl font-bold ${isReversed ? 'line-through text-gray-400' : isIncoming ? 'text-emerald-700' : 'text-gray-900'}`}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                  isIncoming ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {isIncoming ? (
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-700" />
                  )}
                  {payment.payment_type}
                </span>

                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  isReversed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {payment.payment_status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-gray-500 block">Payment Date</span>
                <span className="font-medium text-gray-900">
                  {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN') : '-'}
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">Payment Mode</span>
                <span className="font-medium text-gray-900">
                  {formatPaymentMode(payment.payment_mode)}
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">Category</span>
                <span className="font-medium text-gray-900">
                  {formatCategoryName(payment.category)}
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">Payment ID</span>
                <span className="font-mono font-medium text-gray-900">{payment.payment_id}</span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">Recorded By</span>
                <span className="font-medium text-gray-900">{payment.creator_name || payment.created_by || 'System'}</span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">Recorded On</span>
                <span className="font-medium text-gray-900">
                  {payment.created_at ? new Date(payment.created_at).toLocaleDateString('en-IN') : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Associated Entity Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 border-b pb-2">
              Associated Entity
            </h3>

            {payment.party_id ? (
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-500 block">Party / Company</span>
                  <Link 
                    to={`/parties/${payment.party_id}`}
                    className="text-base font-semibold text-blue-600 hover:underline block"
                  >
                    {payment.party_name || 'View Party'}
                  </Link>
                  {payment.party_type && (
                    <span className="text-xs text-gray-500">Type: {payment.party_type}</span>
                  )}
                </div>
                <Link to={`/parties/${payment.party_id}`}>
                  <Button variant="secondary" size="sm" className="w-full mt-2">
                    View Party Ledger
                  </Button>
                </Link>
              </div>
            ) : payment.vehicle_owner_id ? (
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-500 block">Vehicle Owner</span>
                  <Link 
                    to={`/vehicle-owners/${payment.vehicle_owner_id}`}
                    className="text-base font-semibold text-blue-600 hover:underline block"
                  >
                    {payment.vehicle_owner_name || 'View Vehicle Owner'}
                  </Link>
                </div>
                <Link to={`/vehicle-owners/${payment.vehicle_owner_id}`}>
                  <Button variant="secondary" size="sm" className="w-full mt-2">
                    View Owner Account
                  </Button>
                </Link>
              </div>
            ) : payment.other_business_category_id ? (
              <div className="space-y-2">
                <span className="text-xs text-gray-500 block">Other Business Category</span>
                <span className="text-base font-semibold text-gray-900 block">
                  {payment.other_business_category_name || 'Other Business'}
                </span>
                <span className="text-xs text-gray-500 block">
                  Category Type: {payment.payment_type === 'INCOMING' ? 'Receipt' : 'Payment'}
                </span>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">
                General Business Transaction
              </div>
            )}
          </div>
        </div>

        {/* Allocations Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden space-y-4">
          <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                Payment Allocations
              </h3>
              <p className="text-xs text-gray-500">
                Detailed distribution of this payment according to SSRL single source-of-truth rules.
              </p>
            </div>

            {/* Invariant status pill */}
            <div className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 ${
              isReversed 
                ? 'bg-gray-100 text-gray-600'
                : Math.abs(totalAllocated - Number(payment.amount)) < 0.01 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Allocated: <AmountDisplay amount={totalAllocated} className="font-semibold" /> of{' '}
                <AmountDisplay amount={Number(payment.amount)} className="font-semibold" />
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Allocation Type</th>
                  <th className="px-6 py-3 text-left">Target / Reference</th>
                  <th className="px-6 py-3 text-right">Allocated Amount</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(payment.allocations || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-gray-500">
                      No allocations recorded for this payment.
                    </td>
                  </tr>
                ) : (
                  (payment.allocations || []).map((alloc: PaymentAllocation) => {
                    const isAllocActive = alloc.allocation_status === 'ACTIVE';

                    return (
                      <tr key={alloc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap">
                          {formatAllocationType(alloc.allocation_type)}
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {alloc.allocation_type === 'BILL' && alloc.bill_id ? (
                            <Link to={`/bills/${alloc.bill_id}`} className="text-blue-600 font-mono hover:underline">
                              {alloc.bill_number || alloc.bill_id}
                            </Link>
                          ) : alloc.allocation_type === 'TRIP' && alloc.trip_id ? (
                            <Link to={`/trips/${alloc.trip_id}`} className="text-blue-600 font-mono hover:underline">
                              {alloc.trip_number || alloc.trip_id}
                            </Link>
                          ) : alloc.allocation_type === 'CREDIT_GENERATED' ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 font-medium">
                              Party Balance Credit
                            </span>
                          ) : alloc.allocation_type === 'VEHICLE_OWNER' ? (
                            <span>{alloc.vehicle_owner_name || 'Vehicle Owner Payable'}</span>
                          ) : (
                            <span>General Target</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <AmountDisplay 
                            amount={Number(alloc.allocation_amount)} 
                            className={isAllocActive ? 'text-gray-900 font-semibold' : 'line-through text-gray-400'} 
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isAllocActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {alloc.allocation_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                          {alloc.created_at ? new Date(alloc.created_at).toLocaleString('en-IN') : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FIFO Runs Section (if payment was processed via FIFO) */}
        {(payment.fifo_runs || []).length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              FIFO Automated Allocation Records
            </h3>

            <div className="space-y-4">
              {(payment.fifo_runs || []).map((run) => (
                <div key={run.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 border-b pb-2">
                    <span className="font-semibold text-gray-900">FIFO Run #{run.run_number}</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">{run.run_status}</span>
                    <span>{run.created_at ? new Date(run.created_at).toLocaleString('en-IN') : '-'}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 font-medium text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Seq</th>
                          <th className="px-3 py-2 text-left">Target</th>
                          <th className="px-3 py-2 text-right">Receivable Before</th>
                          <th className="px-3 py-2 text-right">Receivable After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(run.allocations || []).map((ra: any) => (
                          <tr key={ra.id || ra.allocation_ref_id}>
                            <td className="px-3 py-2 font-mono">{ra.allocation_sequence}</td>
                            <td className="px-3 py-2 font-mono text-blue-600">
                              {ra.bill_number ? `Bill: ${ra.bill_number}` : ra.trip_number ? `Trip: ${ra.trip_number}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <AmountDisplay amount={Number(ra.receivable_before)} />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <AmountDisplay amount={Number(ra.receivable_after)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents & Receipts Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Receipts & Attachments
            </h3>

            {!isReversed && canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => uploadDocMutation.mutate('PAYMENT_RECEIPT')}
                disabled={uploadDocMutation.isPending}
                className="flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadDocMutation.isPending ? 'Attaching...' : 'Attach Receipt'}
              </Button>
            )}
          </div>

          {(payment.documents || []).length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4 italic">
              No receipt documents attached yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(payment.documents || []).map((doc: any) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">{doc.original_name || 'Receipt Document'}</p>
                      <p className="text-gray-500">{doc.document_type || 'PAYMENT_RECEIPT'}</p>
                    </div>
                  </div>
                  <a
                    href={`/api/documents/${doc.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-500 hover:text-blue-600 rounded"
                    title="Download document"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Log Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 border-b pb-3">
            <History className="w-5 h-5 text-gray-600" />
            Payment Audit Trail
          </h3>

          {(payment.audit_history || []).length === 0 ? (
            <div className="text-sm text-gray-500 py-3 italic">
              No modification audit events recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {(payment.audit_history || []).map((audit) => (
                <div key={audit.id} className="text-xs border-l-2 border-blue-500 pl-3 py-1 space-y-1">
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="font-semibold text-gray-800">{audit.action_type}</span>
                    <span>{audit.event_time ? new Date(audit.event_time).toLocaleString('en-IN') : '-'}</span>
                  </div>
                  <div className="text-gray-500">
                    Actor: <span className="font-medium text-gray-700">{audit.actor_name || audit.actor_user_id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reverse Payment Modal */}
      {showReverseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 border-b pb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-gray-900">Reverse Payment</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Reversal is <span className="font-semibold text-red-600">permanent and irreversible</span>. 
              All active allocations of this payment will be invalidated and financial ledgers recalculated.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reversal Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Enter detailed reason for payment reversal (min 5 characters)..."
                className="w-full text-sm border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {reverseError && (
              <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
                {reverseError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowReverseModal(false)}
                disabled={reverseMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmReverse}
                disabled={reverseMutation.isPending || reversalReason.trim().length < 5}
              >
                {reverseMutation.isPending ? 'Reversing...' : 'Confirm Reversal'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reallocation Modal (Owner only) */}
      {showReallocateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">Reallocate Payment Funds</h3>
              </div>
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                Payment Total: ₹{Number(payment.amount).toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-gray-500">
              Redistribute the total payment of ₹{Number(payment.amount).toFixed(2)}. The sum of allocations must exactly match the payment total.
            </p>

            {/* Dynamic Rows */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {reallocateAllocations.map((alloc, idx) => (
                <div key={idx} className="flex items-center gap-2 border p-3 rounded-md bg-gray-50 text-xs">
                  <div className="w-1/3">
                    <label className="block text-gray-500 mb-1">Type</label>
                    <select
                      value={alloc.allocation_type}
                      onChange={(e) => handleReallocateChange(idx, 'allocation_type', e.target.value)}
                      className="w-full p-1.5 border rounded bg-white"
                    >
                      {payment.payment_type === 'INCOMING' ? (
                        <>
                          <option value="CREDIT_GENERATED">Party Credit</option>
                          <option value="BILL">Bill</option>
                          <option value="TRIP">Trip</option>
                        </>
                      ) : (
                        <>
                          <option value="OTHER_BUSINESS">Other Business</option>
                          <option value="VEHICLE_OWNER">Vehicle Owner</option>
                          <option value="OWN_FLEET_EXPENSE">Own Fleet Expense</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="w-1/3">
                    <label className="block text-gray-500 mb-1">Target ID (UUID)</label>
                    <input
                      type="text"
                      placeholder="Optional UUID"
                      value={alloc.target_bill_id || alloc.target_trip_id || alloc.target_vehicle_owner_id || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (alloc.allocation_type === 'BILL') handleReallocateChange(idx, 'target_bill_id', val);
                        else if (alloc.allocation_type === 'TRIP') handleReallocateChange(idx, 'target_trip_id', val);
                        else if (alloc.allocation_type === 'VEHICLE_OWNER') handleReallocateChange(idx, 'target_vehicle_owner_id', val);
                      }}
                      className="w-full p-1.5 border rounded bg-white font-mono text-xs"
                    />
                  </div>

                  <div className="w-1/4">
                    <label className="block text-gray-500 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={alloc.allocated_amount}
                      onChange={(e) => handleReallocateChange(idx, 'allocated_amount', parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 border rounded bg-white text-right font-medium"
                    />
                  </div>

                  {reallocateAllocations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveReallocateRow(idx)}
                      className="text-red-500 hover:text-red-700 pt-4"
                      title="Remove row"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-1">
              <Button variant="secondary" size="sm" onClick={handleAddReallocateRow}>
                + Add Allocation Row
              </Button>

              <div className="text-right text-xs">
                <span>Total Allocated: </span>
                <span className="font-bold text-gray-900">
                  ₹{reallocateAllocations.reduce((s, a) => s + (Number(a.allocated_amount) || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Reallocation</label>
              <input
                type="text"
                value={reallocateReason}
                onChange={(e) => setReallocateReason(e.target.value)}
                placeholder="Optional audit reason (min 3 chars if provided)..."
                className="w-full text-xs border border-gray-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {reallocateError && (
              <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
                {reallocateError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="secondary" onClick={() => setShowReallocateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmReallocate} disabled={reallocateMutation.isPending}>
                {reallocateMutation.isPending ? 'Saving...' : 'Apply Reallocation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
