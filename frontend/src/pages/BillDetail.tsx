import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Download, 
  Send, 
  Edit3, 
  XCircle, 
  Building2, 
  History, 
  CreditCard, 
  AlertCircle,
  Eye,
  Layers
} from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { AmountDisplay } from '../components/AmountDisplay';
import { StatusBadge } from '../components/StatusBadge';
import { useAuthStore } from '../store/authStore';
import { 
  getBill, 
  submitBill, 
  cancelBill, 
  createBillVersion, 
  downloadBillPdf,
  type BillVersion,
  type BillItem
} from '../services/api';

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const isOwner = user?.role === 'OWNER';
  const isStaff = user?.role === 'STAFF';
  const isCA = user?.role === 'CA';
  const canMutate = (isOwner || isStaff) && !isCA;
  const canCancel = isOwner && !isCA;

  // Modals state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionItems, setCorrectionItems] = useState<Array<{
    trip_id?: string | null;
    sequence_no: number;
    description: string;
    line_amount: number;
  }>>([]);
  const [correctionError, setCorrectionError] = useState('');

  const [snapshotModalVersion, setSnapshotModalVersion] = useState<BillVersion | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Fetch Bill Detail
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['bill', id],
    queryFn: () => getBill(id!),
    enabled: !!id,
  });

  const bill = data?.data;

  // Submit Mutation
  const submitMutation = useMutation({
    mutationFn: () => submitBill(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', id] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      setShowSubmitModal(false);
      setSubmitError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to submit bill';
      setSubmitError(msg);
    }
  });

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelBill(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', id] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-trips'] });
      setShowCancelModal(false);
      setCancelReason('');
      setCancelError('');
    },
    onError: (err: any) => {
      const errCode = err?.response?.data?.error?.code;
      if (errCode === 'BILL_HAS_ACTIVE_ALLOCATIONS') {
        setCancelError(
          'Cannot cancel bill with active payment allocations. Reallocate or reverse linked payments through the Payment Module first.'
        );
      } else {
        const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to cancel bill';
        setCancelError(msg);
      }
    }
  });

  // Correction / Version Creation Mutation
  const correctionMutation = useMutation({
    mutationFn: (payload: any) => createBillVersion(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', id] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      setShowCorrectionModal(false);
      setCorrectionError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to create bill version';
      setCorrectionError(msg);
    }
  });

  // Handle PDF Download
  const handleDownloadPdf = async (versionNumber?: number) => {
    if (!bill) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      const blob = await downloadBillPdf(bill.id, versionNumber);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const vSuffix = versionNumber ? `-v${versionNumber}` : (bill.current_version ? `-v${bill.current_version}` : '');
      a.download = `Bill-${bill.bill_number}${vSuffix}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setPdfError(err?.message || 'Failed to download bill PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Open correction modal initialized with current items
  const handleOpenCorrection = () => {
    if (!bill) return;
    setCorrectionItems(
      bill.items.map((it: BillItem) => ({
        trip_id: it.trip_id || null,
        sequence_no: it.sequence_no,
        description: it.description,
        line_amount: Number(it.line_amount)
      }))
    );
    setCorrectionError('');
    setShowCorrectionModal(true);
  };

  const handleCorrectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCorrectionError('');

    for (const it of correctionItems) {
      if (it.line_amount < 0 || isNaN(it.line_amount)) {
        setCorrectionError('Line amounts cannot be negative or invalid.');
        return;
      }
    }

    correctionMutation.mutate({
      items: correctionItems
    });
  };

  if (isLoading) {
    return (
      <PageContainer title="Bill Details">
        <div className="bg-white p-12 text-center border border-gray-200 rounded-lg shadow-sm" role="status">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading bill details...</p>
        </div>
      </PageContainer>
    );
  }

  if (isError || !bill) {
    return (
      <PageContainer title="Bill Details">
        <div className="bg-red-50 p-6 rounded-lg border border-red-200 text-center space-y-3">
          <p className="text-red-700 text-sm font-medium">Failed to load bill</p>
          <p className="text-red-600 text-xs">{(error as any)?.message || 'Bill not found'}</p>
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/bills">
              <Button variant="secondary" className="text-xs">Back to Bills</Button>
            </Link>
            <Button onClick={() => refetch()} className="text-xs">Retry</Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const isCancelled = bill.bill_status === 'CANCELLED';
  const isGenerated = bill.bill_status === 'GENERATED';
  const isSubmitted = bill.bill_status === 'SUBMITTED';

  return (
    <PageContainer
      title={`Bill ${bill.bill_number}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/bills">
            <Button variant="secondary" className="text-xs flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          </Link>

          {/* PDF Download Button (Everyone including CA) */}
          <Button
            onClick={() => handleDownloadPdf()}
            disabled={pdfLoading}
            variant="secondary"
            className="text-xs flex items-center gap-1.5"
            aria-label="Download Bill PDF"
          >
            <Download className="w-3.5 h-3.5" />
            {pdfLoading ? 'Loading PDF...' : 'Download PDF'}
          </Button>

          {/* Submit Bill (Owner and Staff, only when GENERATED) */}
          {canMutate && isGenerated && (
            <Button
              onClick={() => { setShowSubmitModal(true); setSubmitError(''); }}
              className="text-xs flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-3.5 h-3.5" />
              Submit Bill
            </Button>
          )}

          {/* Correct Bill / New Version (Owner and Staff, when GENERATED or SUBMITTED) */}
          {canMutate && (isGenerated || isSubmitted) && (
            <Button
              onClick={handleOpenCorrection}
              variant="secondary"
              className="text-xs flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Correct / New Version
            </Button>
          )}

          {/* Cancel Bill (Owner only, when GENERATED or SUBMITTED) */}
          {canCancel && (isGenerated || isSubmitted) && (
            <Button
              onClick={() => { setShowCancelModal(true); setCancelReason(''); setCancelError(''); }}
              variant="secondary"
              className="text-xs flex items-center gap-1.5 text-red-600 hover:bg-red-50 hover:border-red-300"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel Bill
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {pdfError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{pdfError}</span>
          </div>
        )}

        {/* Cancellation Notice Banner */}
        {isCancelled && (
          <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg shadow-sm space-y-1">
            <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
              <XCircle className="w-5 h-5 text-red-600" />
              <span>Bill Cancelled</span>
            </div>
            <p className="text-red-700 text-xs">
              <span className="font-medium">Reason:</span> {bill.cancel_reason || 'Not specified'}
            </p>
            <div className="text-[11px] text-red-600 flex items-center gap-3 pt-1">
              {bill.cancelled_at && <span>Cancelled on: {new Date(bill.cancelled_at).toLocaleString()}</span>}
              {bill.canceller?.name && <span>By: {bill.canceller.name}</span>}
            </div>
            <p className="text-[11px] text-gray-500 pt-1">
              All linked trips have been unbilled and returned to the eligible pool. Cancelled bill numbers are permanently retired and cannot be reused.
            </p>
          </div>
        )}

        {/* Header Summary Card */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{bill.bill_number}</h1>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-mono font-semibold">
                  v{bill.current_version}
                </span>
                <StatusBadge status={bill.bill_status} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2">
                <span>Date: <strong className="text-gray-700">{bill.bill_date}</strong></span>
                <span>•</span>
                <span>FY: <strong className="text-gray-700">{bill.financial_year?.code || (bill as any).financial_year_code || (bill as any).fy_name || 'N/A'}</strong></span>
                <span>•</span>
                <span>Mode: <strong className="text-gray-700">{bill.billing_mode}</strong></span>
                {bill.submitted_at && (
                  <>
                    <span>•</span>
                    <span>Submitted: <strong className="text-gray-700">{new Date(bill.submitted_at).toLocaleDateString()}</strong></span>
                  </>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <div>Created by: <span className="text-gray-800 font-medium">{bill.creator?.name || 'Staff'}</span></div>
              <div>Created on: <span className="text-gray-800">{new Date(bill.created_at).toLocaleDateString()}</span></div>
            </div>
          </div>

          {/* Authoritative Financial Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Total Bill Amount</div>
              <div className="text-xl font-bold text-gray-900 mt-1">
                <AmountDisplay amount={bill.total_amount} />
              </div>
            </div>

            <div className="bg-green-50/60 p-4 rounded-lg border border-green-100 text-center">
              <div className="text-xs text-green-700 uppercase tracking-wider font-medium">Paid Amount</div>
              <div className="text-xl font-bold text-green-700 mt-1">
                <AmountDisplay amount={bill.paid_amount} />
              </div>
            </div>

            <div className={`p-4 rounded-lg border text-center ${
              Number(bill.balance_amount) > 0 ? 'bg-amber-50/60 border-amber-100' : 'bg-gray-50 border-gray-100'
            }`}>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Outstanding Balance</div>
              <div className="text-xl font-bold text-gray-900 mt-1">
                <AmountDisplay amount={bill.balance_amount} />
              </div>
            </div>
          </div>
        </div>

        {/* Billed Party Information */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-800">Billed Customer / Party Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <div>
                <span className="text-gray-500 font-medium">Party Name: </span>
                <Link to={`/parties/${bill.party.id}`} className="text-blue-600 hover:underline font-semibold">
                  {bill.party.name}
                </Link>
              </div>
              <div>
                <span className="text-gray-500 font-medium">GSTIN: </span>
                <span className="font-mono text-gray-800">{bill.party.gstin || 'Unregistered'}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Contact: </span>
                <span className="text-gray-800">{bill.party.primary_mobile || 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div>
                <span className="text-gray-500 font-medium">Registered Address: </span>
                <span className="text-gray-800">{bill.party.address || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Billing Address: </span>
                <span className="text-gray-800">{bill.party.billing_address || bill.party.address || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">City / State: </span>
                <span className="text-gray-800">{[bill.party.city, bill.party.state, bill.party.pin_code].filter(Boolean).join(', ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-800">Line Items & Trip References</h2>
            </div>
            <span className="text-xs text-gray-500">{bill.items.length} items</span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-md">
            <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="px-3 py-2.5 text-center w-12">#</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5">Trip No.</th>
                  <th className="px-3 py-2.5">Vehicle</th>
                  <th className="px-3 py-2.5">Route</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-3 py-2.5 text-right">Line Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bill.items.map((item: BillItem) => (
                  <tr key={item.id} className="hover:bg-gray-50/70">
                    <td className="px-3 py-2 text-center text-gray-500 font-mono">
                      {item.sequence_no}
                    </td>
                    <td className="px-3 py-2 text-gray-900 font-medium max-w-sm">
                      {item.description}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {item.trip_id ? (
                        <Link to={`/trips/${item.trip_id}`} className="text-blue-600 hover:underline">
                          {item.trip_number || 'View Trip'}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {item.vehicle_number || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {item.route_origin && item.route_destination 
                        ? `${item.route_origin} → ${item.route_destination}` 
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {item.quantity ?? '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {item.unit_price ? <AmountDisplay amount={item.unit_price} /> : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">
                      <AmountDisplay amount={item.line_amount} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold text-gray-900">
                <tr>
                  <td colSpan={7} className="px-3 py-2.5 text-right">Total:</td>
                  <td className="px-3 py-2.5 text-right">
                    <AmountDisplay amount={bill.total_amount} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Version History Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-800">Version History & Snapshots</h2>
            </div>
            <span className="text-xs text-gray-500">{bill.versions.length} versions recorded</span>
          </div>

          <div className="space-y-3">
            {bill.versions.map((v: BillVersion) => {
              const isCurrent = v.version_status === 'ACTIVE';
              return (
                <div 
                  key={v.id} 
                  className={`p-4 rounded-lg border transition-all ${
                    isCurrent 
                      ? 'border-blue-200 bg-blue-50/20' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900 text-sm">
                        Version {v.version_number}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        v.version_status === 'ACTIVE' 
                          ? 'bg-green-100 text-green-800' 
                          : v.version_status === 'SUPERSEDED'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {v.version_status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(v.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        className="text-xs py-1 px-2.5 flex items-center gap-1"
                        onClick={() => setSnapshotModalVersion(v)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect Items ({v.items?.length || 0})
                      </Button>
                      <Button
                        variant="secondary"
                        className="text-xs py-1 px-2.5 flex items-center gap-1"
                        onClick={() => handleDownloadPdf(v.version_number)}
                        disabled={pdfLoading}
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF (v{v.version_number})
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-2 flex items-center gap-4">
                    <span>Created By: <strong className="text-gray-700">{v.creator_name || 'Staff'}</strong></span>
                    {v.totals_snapshot?.total_amount && (
                      <span>Snapshot Total: <strong className="text-gray-900"><AmountDisplay amount={v.totals_snapshot.total_amount} /></strong></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Allocations Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-800">Payment Allocations</h2>
            </div>
            <span className="text-xs text-gray-500">{bill.allocations.length} allocations</span>
          </div>

          {bill.allocations.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-xs bg-gray-50 rounded border border-gray-100">
              No payments have been allocated to this bill yet. Payments must be recorded through the Payment Module.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="px-3 py-2.5">Payment ID</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Mode</th>
                    <th className="px-3 py-2.5 text-right">Allocated Amount</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5">Allocated By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bill.allocations.map((alloc) => (
                    <tr key={alloc.id} className="hover:bg-gray-50/70">
                      <td className="px-3 py-2 font-semibold text-blue-600">
                        {alloc.payment_id ? (
                          <Link to={`/payments/${alloc.payment_id}`} className="hover:underline">
                            {alloc.payment_number || alloc.payment_id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-gray-500">Credit Utilization</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {alloc.allocation_type}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {alloc.payment_date || new Date(alloc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {alloc.payment_mode || '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        <AmountDisplay amount={alloc.allocation_amount} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          alloc.allocation_status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {alloc.allocation_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {alloc.created_by_name || 'Staff'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. Submit Confirmation Modal */}
      {/* ======================================================== */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-semibold text-base">
              <Send className="w-5 h-5 text-blue-600" />
              <span>Submit Bill {bill.bill_number}</span>
            </div>
            <p className="text-xs text-gray-600">
              Submitting transitions the bill from <strong>GENERATED</strong> to <strong>SUBMITTED</strong>, confirming that the document has been dispatched to the customer.
            </p>
            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded text-xs">
                {submitError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="secondary" 
                className="text-xs" 
                onClick={() => setShowSubmitModal(false)}
                disabled={submitMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                className="text-xs" 
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? 'Submitting...' : 'Confirm Submit'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. Cancellation Modal (Owner Only) */}
      {/* ======================================================== */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-base">
              <XCircle className="w-5 h-5 text-red-600" />
              <span>Cancel Bill {bill.bill_number}</span>
            </div>
            <p className="text-xs text-gray-600">
              Cancelling a bill will retire the bill number <strong>{bill.bill_number}</strong> permanently. 
              All linked trips will return to the unbilled pool.
            </p>

            {cancelError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Cancellation Blocked</span>
                </div>
                <div>{cancelError}</div>
              </div>
            )}

            <div>
              <label htmlFor="cancel-reason-input" className="block text-xs font-medium text-gray-700 mb-1">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="cancel-reason-input"
                rows={3}
                placeholder="Explain reason for cancelling this bill (min 5 characters)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="secondary" 
                className="text-xs" 
                onClick={() => setShowCancelModal(false)}
                disabled={cancelMutation.isPending}
              >
                Dismiss
              </Button>
              <Button 
                className="text-xs bg-red-600 hover:bg-red-700" 
                onClick={() => cancelMutation.mutate(cancelReason)}
                disabled={cancelMutation.isPending || cancelReason.trim().length < 5}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. Correction / New Version Modal */}
      {/* ======================================================== */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-gray-900 font-semibold text-base">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <span>Correct Bill — Create Version {bill.current_version + 1}</span>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                Bill: {bill.bill_number}
              </span>
            </div>

            <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-100 space-y-1">
              <p className="font-semibold text-blue-800">Version Immutability Rule:</p>
              <p>
                Corrections will create a new Version ({bill.current_version + 1}) under the same Bill Number. 
                All historical version snapshots (v1 to v{bill.current_version}) remain permanently immutable.
              </p>
            </div>

            {correctionError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{correctionError}</span>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-700">Line Items to Revise</h3>
              <div className="space-y-2">
                {correctionItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2.5 rounded border border-gray-200 text-xs">
                    <span className="col-span-1 text-center font-mono text-gray-500">#{item.sequence_no}</span>
                    <div className="col-span-7">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...correctionItems];
                          updated[idx].description = e.target.value;
                          setCorrectionItems(updated);
                        }}
                        placeholder="Description..."
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                        required
                      />
                    </div>
                    <div className="col-span-4">
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-gray-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.line_amount}
                          onChange={(e) => {
                            const updated = [...correctionItems];
                            updated[idx].line_amount = parseFloat(e.target.value) || 0;
                            setCorrectionItems(updated);
                          }}
                          className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded text-xs font-mono text-right bg-white"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center bg-gray-100 p-3 rounded text-xs font-semibold">
                <span>Revised Bill Total:</span>
                <span>
                  <AmountDisplay 
                    amount={correctionItems.reduce((acc, it) => acc + (it.line_amount || 0), 0)} 
                  />
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button 
                variant="secondary" 
                className="text-xs" 
                onClick={() => setShowCorrectionModal(false)}
                disabled={correctionMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                className="text-xs" 
                onClick={handleCorrectionSubmit}
                disabled={correctionMutation.isPending}
              >
                {correctionMutation.isPending ? 'Saving Version...' : `Save as Version ${bill.current_version + 1}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. Inspect Historical Version Snapshot Modal */}
      {/* ======================================================== */}
      {snapshotModalVersion && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900 text-base">
                  Historical Snapshot — Version {snapshotModalVersion.version_number}
                </h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                snapshotModalVersion.version_status === 'ACTIVE' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {snapshotModalVersion.version_status}
              </span>
            </div>

            <div className="text-xs text-gray-500 flex items-center gap-4">
              <span>Created on: {new Date(snapshotModalVersion.created_at).toLocaleString()}</span>
              <span>By: {snapshotModalVersion.creator_name || 'Staff'}</span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="px-3 py-2 w-10 text-center">#</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Trip</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(snapshotModalVersion.items || []).map((it) => (
                    <tr key={it.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center text-gray-500 font-mono">{it.sequence_no}</td>
                      <td className="px-3 py-2 text-gray-900 font-medium">{it.description}</td>
                      <td className="px-3 py-2 text-gray-600">{it.trip_number || '-'}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        <AmountDisplay amount={it.line_amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="secondary"
                className="text-xs flex items-center gap-1.5"
                onClick={() => handleDownloadPdf(snapshotModalVersion.version_number)}
                disabled={pdfLoading}
              >
                <Download className="w-3.5 h-3.5" />
                Download Version PDF
              </Button>
              <Button 
                variant="secondary" 
                className="text-xs" 
                onClick={() => setSnapshotModalVersion(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
