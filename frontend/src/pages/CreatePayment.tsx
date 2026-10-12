import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  ArrowDownLeft, 
  ArrowUpRight 
} from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { 
  createPayment, 
  getParties, 
  getVehicleOwners, 
  getPartyBills, 
  getPartyTrips, 
  getVehicleOwnerTrips,
  getOtherBusinessCategories,
  getOwnFleetVehicles
} from '../services/api';

type PaymentDirection = 'INCOMING' | 'OUTGOING';
type PaymentCategory = 
  | 'COMPANY_PAYMENT' 
  | 'MARKET_PARTY_PAYMENT' 
  | 'OTHER_BUSINESS_RECEIPT'
  | 'VEHICLE_OWNER_PAYMENT' 
  | 'OWN_FLEET_EXPENSE' 
  | 'OTHER_BUSINESS_PAYMENT';

type AllocationType = 
  | 'BILL' 
  | 'TRIP' 
  | 'CREDIT_GENERATED' 
  | 'VEHICLE_OWNER' 
  | 'OWN_FLEET_EXPENSE' 
  | 'OTHER_BUSINESS';

interface AllocationRow {
  allocation_type: AllocationType;
  allocated_amount: number | string;
  target_bill_id?: string;
  target_trip_id?: string;
  target_vehicle_owner_id?: string;
  target_own_fleet_expense_detail_id?: string;
}

export default function CreatePayment() {
  const navigate = useNavigate();

  // Core Payment States
  const [direction, setDirection] = useState<PaymentDirection>('INCOMING');
  const [category, setCategory] = useState<PaymentCategory>('COMPANY_PAYMENT');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');
  const [amount, setAmount] = useState<string>('');

  // Entity States
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [selectedOtherCatId, setSelectedOtherCatId] = useState<string>('');
  const [selectedOwnFleetId, setSelectedOwnFleetId] = useState<string>('');

  // Allocations State
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [formError, setFormError] = useState<string>('');

  // Queries for masters
  const { data: partiesData } = useQuery({
    queryKey: ['parties'],
    queryFn: () => getParties(),
  });

  const { data: ownersData } = useQuery({
    queryKey: ['vehicle-owners'],
    queryFn: () => getVehicleOwners(),
  });

  const { data: otherCatsData } = useQuery({
    queryKey: ['other-business-categories', direction === 'INCOMING' ? 'RECEIPT' : 'PAYMENT'],
    queryFn: () => getOtherBusinessCategories(direction === 'INCOMING' ? 'RECEIPT' : 'PAYMENT'),
  });

  const { data: ownFleetData } = useQuery({
    queryKey: ['own-fleet'],
    queryFn: () => getOwnFleetVehicles(),
  });

  // Queries for selected entity's related records
  const { data: partyBillsData } = useQuery({
    queryKey: ['party-bills', selectedPartyId],
    queryFn: () => getPartyBills(selectedPartyId),
    enabled: !!selectedPartyId && (category === 'COMPANY_PAYMENT' || category === 'MARKET_PARTY_PAYMENT'),
  });

  const { data: partyTripsData } = useQuery({
    queryKey: ['party-trips', selectedPartyId],
    queryFn: () => getPartyTrips(selectedPartyId),
    enabled: !!selectedPartyId && (category === 'COMPANY_PAYMENT' || category === 'MARKET_PARTY_PAYMENT'),
  });

  const { data: ownerTripsData } = useQuery({
    queryKey: ['owner-trips', selectedOwnerId],
    queryFn: () => getVehicleOwnerTrips(selectedOwnerId),
    enabled: !!selectedOwnerId && category === 'VEHICLE_OWNER_PAYMENT',
  });

  // Handle direction switch
  const handleDirectionChange = (newDir: PaymentDirection) => {
    setDirection(newDir);
    if (newDir === 'INCOMING') {
      setCategory('COMPANY_PAYMENT');
    } else {
      setCategory('VEHICLE_OWNER_PAYMENT');
    }
    setAllocations([]);
  };

  // Handle category change
  const handleCategoryChange = (newCat: PaymentCategory) => {
    setCategory(newCat);
    setAllocations([]);
    setFormError('');
  };

  // When amount changes, if only 1 simple allocation row exists, update it
  const handleAmountChange = (newAmountStr: string) => {
    setAmount(newAmountStr);
    const num = parseFloat(newAmountStr) || 0;
    if (allocations.length === 1 && ['OTHER_BUSINESS', 'OWN_FLEET_EXPENSE'].includes(allocations[0].allocation_type)) {
      setAllocations([{ ...allocations[0], allocated_amount: num }]);
    }
  };

  // Setup default allocation when non-split categories are chosen
  useEffect(() => {
    const num = parseFloat(amount) || 0;
    if (category === 'OTHER_BUSINESS_RECEIPT' || category === 'OTHER_BUSINESS_PAYMENT') {
      setAllocations([{ allocation_type: 'OTHER_BUSINESS', allocated_amount: num }]);
    } else if (category === 'OWN_FLEET_EXPENSE') {
      setAllocations([{ allocation_type: 'OWN_FLEET_EXPENSE', allocated_amount: num }]);
    } else if (category === 'VEHICLE_OWNER_PAYMENT' && allocations.length === 0 && num > 0) {
      setAllocations([{ allocation_type: 'VEHICLE_OWNER', allocated_amount: num, target_vehicle_owner_id: selectedOwnerId }]);
    }
  }, [category, selectedOwnerId]);

  // Allocation row handlers
  const handleAddAllocation = (type: AllocationType) => {
    const numAmount = parseFloat(amount) || 0;
    const currentAllocated = allocations.reduce((sum, a) => sum + (parseFloat(String(a.allocated_amount)) || 0), 0);
    const remainder = Math.max(0, numAmount - currentAllocated);

    setAllocations([
      ...allocations,
      {
        allocation_type: type,
        allocated_amount: remainder > 0 ? remainder : '',
        target_vehicle_owner_id: type === 'VEHICLE_OWNER' ? selectedOwnerId : undefined
      }
    ]);
  };

  const handleUpdateAllocation = (index: number, field: keyof AllocationRow, value: any) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    setAllocations(updated);
  };

  const handleRemoveAllocation = (index: number) => {
    setAllocations(allocations.filter((_, idx) => idx !== index));
  };

  const handleAllocateRemainderAsCredit = () => {
    const numAmount = parseFloat(amount) || 0;
    const currentAllocated = allocations.reduce((sum, a) => sum + (parseFloat(String(a.allocated_amount)) || 0), 0);
    const remainder = numAmount - currentAllocated;
    if (remainder <= 0) return;

    setAllocations([
      ...allocations,
      {
        allocation_type: 'CREDIT_GENERATED',
        allocated_amount: Math.round(remainder * 100) / 100
      }
    ]);
  };

  // Calculations
  const parsedAmount = parseFloat(amount) || 0;
  const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(String(a.allocated_amount)) || 0), 0);
  const remainingToAllocate = Math.round((parsedAmount - totalAllocated) * 100) / 100;
  const isComplete = parsedAmount > 0 && Math.abs(remainingToAllocate) < 0.01 && allocations.length > 0;

  // Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => createPayment(payload),
    onSuccess: (res) => {
      navigate(`/payments/${res.data.id}`);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to record payment');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (parsedAmount <= 0) {
      setFormError('Payment amount must be greater than zero.');
      return;
    }

    if (!isComplete) {
      setFormError(`Allocations must exactly equal the payment amount. Remaining difference: ₹${remainingToAllocate.toFixed(2)}.`);
      return;
    }

    // Prepare payload
    const payload: any = {
      payment_direction: direction,
      payment_category: category,
      payment_date: paymentDate,
      payment_mode: paymentMode,
      amount: parsedAmount,
      party_id: (category === 'COMPANY_PAYMENT' || category === 'MARKET_PARTY_PAYMENT') ? selectedPartyId || null : null,
      vehicle_owner_id: category === 'VEHICLE_OWNER_PAYMENT' ? selectedOwnerId || null : null,
      other_business_category_id: (category === 'OTHER_BUSINESS_RECEIPT' || category === 'OTHER_BUSINESS_PAYMENT') ? selectedOtherCatId || null : null,
      allocations: allocations.map((a) => ({
        allocation_type: a.allocation_type,
        allocated_amount: parseFloat(String(a.allocated_amount)),
        target_bill_id: a.target_bill_id || null,
        target_trip_id: a.target_trip_id || null,
        target_vehicle_owner_id: a.target_vehicle_owner_id || (category === 'VEHICLE_OWNER_PAYMENT' ? selectedOwnerId : null),
        target_own_fleet_expense_detail_id: a.target_own_fleet_expense_detail_id || null
      }))
    };

    createMutation.mutate(payload);
  };

  const parties = partiesData?.data || [];
  const owners = ownersData?.data || [];
  const otherCats = otherCatsData?.data || [];
  const ownFleet = ownFleetData?.data || [];
  const partyBills = partyBillsData?.data || [];
  const partyTrips = partyTripsData?.data || [];
  const ownerTrips = ownerTripsData?.data || [];

  return (
    <PageContainer 
      title="Record Payment" 
      actions={
        <Button variant="secondary" onClick={() => navigate('/payments')} className="flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to Payments
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* Error notification */}
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-sm text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Section 1: Direction & Category */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 border-b pb-2">
            1. Payment Classification
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direction Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Direction</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('INCOMING')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    direction === 'INCOMING'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  Incoming (Receipt)
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectionChange('OUTGOING')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    direction === 'OUTGOING'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-blue-600" />
                  Outgoing (Payment)
                </button>
              </div>
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as PaymentCategory)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                {direction === 'INCOMING' ? (
                  <>
                    <option value="COMPANY_PAYMENT">Company Payment (Tied-up)</option>
                    <option value="MARKET_PARTY_PAYMENT">Market Party Payment</option>
                    <option value="OTHER_BUSINESS_RECEIPT">Other Business Receipt</option>
                  </>
                ) : (
                  <>
                    <option value="VEHICLE_OWNER_PAYMENT">Vehicle Owner Payment (Market Vehicle)</option>
                    <option value="OWN_FLEET_EXPENSE">Own Fleet Expense</option>
                    <option value="OTHER_BUSINESS_PAYMENT">Other Business Payment</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Entity Selection */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 border-b pb-2">
            2. Associated Entity
          </h2>

          {(category === 'COMPANY_PAYMENT' || category === 'MARKET_PARTY_PAYMENT') && (
            <div>
              <label htmlFor="party-select" className="block text-xs font-semibold text-gray-700 mb-1">
                Select Party / Company <span className="text-red-500">*</span>
              </label>
              <select
                id="party-select"
                value={selectedPartyId}
                onChange={(e) => { setSelectedPartyId(e.target.value); setAllocations([]); }}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">-- Choose Party --</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.party_type}) - {p.primary_mobile}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'VEHICLE_OWNER_PAYMENT' && (
            <div>
              <label htmlFor="owner-select" className="block text-xs font-semibold text-gray-700 mb-1">
                Select Vehicle Owner <span className="text-red-500">*</span>
              </label>
              <select
                id="owner-select"
                value={selectedOwnerId}
                onChange={(e) => { setSelectedOwnerId(e.target.value); setAllocations([]); }}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">-- Choose Vehicle Owner --</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.mobile_number})
                  </option>
                ))}
              </select>
            </div>
          )}

          {(category === 'OTHER_BUSINESS_RECEIPT' || category === 'OTHER_BUSINESS_PAYMENT') && (
            <div>
              <label htmlFor="other-cat-select" className="block text-xs font-semibold text-gray-700 mb-1">
                Other Business Category <span className="text-red-500">*</span>
              </label>
              <select
                id="other-cat-select"
                value={selectedOtherCatId}
                onChange={(e) => setSelectedOtherCatId(e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">-- Choose Category --</option>
                {otherCats.map((oc) => (
                  <option key={oc.id} value={oc.id}>
                    {oc.category_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'OWN_FLEET_EXPENSE' && (
            <div>
              <label htmlFor="own-fleet-select" className="block text-xs font-semibold text-gray-700 mb-1">
                Select Own Fleet Vehicle (Optional Reference)
              </label>
              <select
                id="own-fleet-select"
                value={selectedOwnFleetId}
                onChange={(e) => setSelectedOwnFleetId(e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">-- General Own Fleet Expense --</option>
                {ownFleet.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_number} ({v.vehicle_type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section 3: Core Payment Details */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 border-b pb-2">
            3. Payment Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Payment Date */}
            <div>
              <label htmlFor="payment-date" className="block text-xs font-semibold text-gray-700 mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Payment Mode */}
            <div>
              <label htmlFor="payment-mode" className="block text-xs font-semibold text-gray-700 mb-1">
                Payment Mode <span className="text-red-500">*</span>
              </label>
              <select
                id="payment-mode"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                required
              >
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            {/* Total Amount */}
            <div>
              <label htmlFor="total-amount" className="block text-xs font-semibold text-gray-700 mb-1">
                Total Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                id="total-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full p-2.5 text-sm font-semibold border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 4: Allocations & Completeness Invariant */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3 gap-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                4. Allocations & Single Source-of-Truth
              </h2>
              <p className="text-xs text-gray-500">
                Full payment amount must be 100% accounted for before recording.
              </p>
            </div>

            {/* Helper buttons for Party Receipts */}
            {(category === 'COMPANY_PAYMENT' || category === 'MARKET_PARTY_PAYMENT') && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddAllocation('BILL')}
                >
                  + Add Bill
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddAllocation('TRIP')}
                >
                  + Add Trip
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={remainingToAllocate <= 0}
                  onClick={handleAllocateRemainderAsCredit}
                  className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                >
                  + Remainder as Credit
                </Button>
              </div>
            )}

            {/* Helper for Vehicle Owner payments */}
            {category === 'VEHICLE_OWNER_PAYMENT' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleAddAllocation('VEHICLE_OWNER')}
              >
                + Add Owner Allocation
              </Button>
            )}
          </div>

          {/* Allocation Rows */}
          {allocations.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
              No allocations added yet. Click an allocation button above to distribute this payment.
            </div>
          ) : (
            <div className="space-y-3">
              {allocations.map((alloc, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col md:flex-row items-center gap-3 text-sm">
                  {/* Allocation Type */}
                  <div className="w-full md:w-1/4">
                    <label className="block text-xs text-gray-500 mb-1">Type</label>
                    <span className="font-semibold text-gray-800">
                      {alloc.allocation_type === 'BILL' ? 'Bill Payment' :
                       alloc.allocation_type === 'TRIP' ? 'Trip Freight' :
                       alloc.allocation_type === 'CREDIT_GENERATED' ? 'Party Credit (Excess)' :
                       alloc.allocation_type === 'VEHICLE_OWNER' ? 'Vehicle Owner Payable' :
                       alloc.allocation_type === 'OWN_FLEET_EXPENSE' ? 'Own Fleet Expense' :
                       'Other Business'}
                    </span>
                  </div>

                  {/* Target Selector */}
                  <div className="w-full md:w-1/2">
                    <label className="block text-xs text-gray-500 mb-1">Target Document / Reference</label>
                    {alloc.allocation_type === 'BILL' ? (
                      <select
                        value={alloc.target_bill_id || ''}
                        onChange={(e) => handleUpdateAllocation(idx, 'target_bill_id', e.target.value)}
                        className="w-full p-2 text-xs border rounded bg-white"
                        required
                      >
                        <option value="">-- Select Bill --</option>
                        {partyBills.map((b) => (
                          <option key={b.id} value={b.id}>
                            Bill #{b.bill_number} - Total ₹{Number(b.total_amount).toFixed(2)} ({b.status})
                          </option>
                        ))}
                      </select>
                    ) : alloc.allocation_type === 'TRIP' ? (
                      <select
                        value={alloc.target_trip_id || ''}
                        onChange={(e) => handleUpdateAllocation(idx, 'target_trip_id', e.target.value)}
                        className="w-full p-2 text-xs border rounded bg-white"
                        required
                      >
                        <option value="">-- Select Trip --</option>
                        {partyTrips.map((t) => (
                          <option key={t.id} value={t.id}>
                            Trip #{t.trip_number} - {t.from_location} to {t.to_location}
                          </option>
                        ))}
                      </select>
                    ) : alloc.allocation_type === 'VEHICLE_OWNER' ? (
                      <select
                        value={alloc.target_trip_id || ''}
                        onChange={(e) => handleUpdateAllocation(idx, 'target_trip_id', e.target.value || undefined)}
                        className="w-full p-2 text-xs border rounded bg-white"
                      >
                        <option value="">-- General Owner Settlement --</option>
                        {ownerTrips.map((t) => (
                          <option key={t.id} value={t.id}>
                            Trip #{t.trip_number} ({t.from_location} to {t.to_location})
                          </option>
                        ))}
                      </select>
                    ) : alloc.allocation_type === 'CREDIT_GENERATED' ? (
                      <span className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded inline-block">
                        Excess amount stored as party credit for future FIFO/manual allocation
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 italic">Direct Category Allocation</span>
                    )}
                  </div>

                  {/* Allocated Amount */}
                  <div className="w-full md:w-1/4">
                    <label className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={alloc.allocated_amount}
                      onChange={(e) => handleUpdateAllocation(idx, 'allocated_amount', parseFloat(e.target.value) || 0)}
                      className="w-full p-2 text-sm font-semibold border rounded bg-white text-right"
                      required
                    />
                  </div>

                  {/* Remove Button */}
                  {allocations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAllocation(idx)}
                      className="p-2 text-red-500 hover:text-red-700 self-end md:self-center"
                      title="Remove allocation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Allocation Invariant Summary Box */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-xs">
              <div>
                <span className="text-gray-500">Payment Amount: </span>
                <span className="font-semibold text-gray-900">₹{parsedAmount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Allocated: </span>
                <span className="font-semibold text-gray-900">₹{totalAllocated.toFixed(2)}</span>
              </div>
            </div>

            <div className={`px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-2 ${
              isComplete
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              {isComplete ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>100% Fully Allocated (Complete)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  <span>
                    Remaining: ₹{remainingToAllocate.toFixed(2)}{' '}
                    {remainingToAllocate < 0 ? '(Over-allocated!)' : '(Must be zero)'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end gap-3 pt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/payments')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!isComplete || createMutation.isPending}
            className="px-6"
          >
            {createMutation.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
