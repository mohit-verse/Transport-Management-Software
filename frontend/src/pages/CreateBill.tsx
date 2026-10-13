import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, FileText, Building, Hash } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { AmountDisplay } from '../components/AmountDisplay';
import { 
  getParties, 
  getEligibleTrips, 
  getFinancialYears, 
  getNumberingSeries, 
  generateBill,
  type EligibleTrip,
  type NumberingSeries
} from '../services/api';

export default function CreateBill() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form State
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [billingMode, setBillingMode] = useState<'INDIVIDUAL' | 'CONSOLIDATED'>('CONSOLIDATED');
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [selectedFyId, setSelectedFyId] = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState('');

  // 1. Fetch Parties
  const { data: partiesData } = useQuery({
    queryKey: ['parties'],
    queryFn: () => getParties(),
  });
  const parties = partiesData?.data || [];
  const selectedParty = parties.find((p: any) => p.id === selectedPartyId);

  // When party changes, check if party has a locked billing mode in billing_configuration
  useEffect(() => {
    if (selectedParty) {
      const partyMode = selectedParty.billing_configuration?.billing_mode;
      if (partyMode === 'INDIVIDUAL' || partyMode === 'CONSOLIDATED') {
        setBillingMode(partyMode);
      }
      // Reset selected trips when party changes
      setSelectedTripIds([]);
    }
  }, [selectedPartyId, selectedParty]);

  // 2. Fetch Eligible Unbilled Trips for Selected Party
  const { 
    data: eligibleTripsData, 
    isLoading: isLoadingTrips, 
    isError: isTripsError,
    error: tripsError 
  } = useQuery({
    queryKey: ['eligible-trips', selectedPartyId],
    queryFn: () => getEligibleTrips(selectedPartyId),
    enabled: !!selectedPartyId,
  });
  const eligibleTrips = eligibleTripsData?.data || [];

  // 3. Fetch Financial Years
  const { data: fyData } = useQuery({
    queryKey: ['financial-years'],
    queryFn: () => getFinancialYears(),
  });
  const financialYears = fyData?.data || [];

  // Auto-select active Financial Year if none selected
  useEffect(() => {
    if (financialYears.length > 0 && !selectedFyId) {
      const activeFy = financialYears.find((fy: any) => fy.is_active) || financialYears[0];
      if (activeFy) setSelectedFyId(activeFy.id);
    }
  }, [financialYears, selectedFyId]);

  // 4. Fetch Numbering Series for Party and FY
  const { 
    data: seriesData 
  } = useQuery({
    queryKey: ['numbering-series', selectedPartyId, selectedFyId],
    queryFn: () => getNumberingSeries(selectedPartyId, selectedFyId),
    enabled: !!selectedPartyId && !!selectedFyId,
  });
  const numberingSeriesList: NumberingSeries[] = seriesData?.data || [];

  // Auto-select numbering series if only one available
  useEffect(() => {
    if (numberingSeriesList.length === 1) {
      setSelectedSeriesId(numberingSeriesList[0].id);
    } else if (numberingSeriesList.length > 0 && !numberingSeriesList.find(s => s.id === selectedSeriesId)) {
      setSelectedSeriesId(numberingSeriesList[0].id);
    } else if (numberingSeriesList.length === 0) {
      setSelectedSeriesId('');
    }
  }, [numberingSeriesList, selectedSeriesId]);

  // Trip selection toggles
  const handleTripToggle = (tripId: string) => {
    if (billingMode === 'INDIVIDUAL') {
      setSelectedTripIds([tripId]);
    } else {
      setSelectedTripIds((prev) => 
        prev.includes(tripId) ? prev.filter((id) => id !== tripId) : [...prev, tripId]
      );
    }
  };

  const handleSelectAllTrips = () => {
    if (billingMode === 'INDIVIDUAL') return;
    if (selectedTripIds.length === eligibleTrips.length) {
      setSelectedTripIds([]);
    } else {
      setSelectedTripIds(eligibleTrips.map((t) => t.id));
    }
  };

  // Preview calculations
  const selectedTrips = eligibleTrips.filter((t) => selectedTripIds.includes(t.id));
  const previewTotalReceivable = selectedTrips.reduce((acc, t) => acc + Number(t.receivable_amount || 0), 0);

  // Generate Bill Mutation
  const generateMutation = useMutation({
    mutationFn: (payload: any) => generateBill(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-trips', selectedPartyId] });
      const newBill = res.data?.bill;
      if (newBill?.id) {
        navigate(`/bills/${newBill.id}`);
      } else {
        navigate('/bills');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to generate bill.';
      setFormError(msg);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedPartyId) {
      setFormError('Please select a Party/Company.');
      return;
    }
    if (selectedTripIds.length === 0) {
      setFormError('Please select at least one eligible trip to bill.');
      return;
    }
    if (billingMode === 'INDIVIDUAL' && selectedTripIds.length > 1) {
      setFormError('Individual billing mode supports only one trip per bill.');
      return;
    }
    if (!selectedFyId) {
      setFormError('Please select a Financial Year.');
      return;
    }
    if (!selectedSeriesId) {
      setFormError('Please select a Numbering Series. Configure one under billing settings if none exist.');
      return;
    }
    if (!billDate) {
      setFormError('Please select a valid Bill Date.');
      return;
    }

    const payload = {
      party_id: selectedPartyId,
      financial_year_id: selectedFyId,
      numbering_series_id: selectedSeriesId,
      billing_mode: billingMode,
      bill_date: billDate,
      trip_ids: selectedTripIds,
      template_snapshot: {}
    };

    generateMutation.mutate(payload);
  };

  return (
    <PageContainer
      title="Generate New Bill"
      actions={
        <Link to="/bills">
          <Button variant="secondary" className="flex items-center gap-2 text-xs">
            <ArrowLeft className="w-4 h-4" />
            Back to Bills
          </Button>
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            <div className="text-sm">
              <span className="font-semibold">Billing Error: </span>
              {formError}
            </div>
          </div>
        )}

        {/* Step 1: Party and Billing Mode */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Building className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-800">1. Select Party & Billing Mode</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="party-dropdown" className="block text-xs font-medium text-gray-700 mb-1">
                Billed Party / Company <span className="text-red-500">*</span>
              </label>
              <select
                id="party-dropdown"
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">-- Choose Party --</option>
                {parties.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.party_type})
                  </option>
                ))}
              </select>
              {selectedParty && (
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2.5 rounded border border-gray-100 space-y-1">
                  <div><span className="font-medium">GSTIN:</span> {selectedParty.gstin || 'Unregistered'}</div>
                  <div><span className="font-medium">Address:</span> {selectedParty.address || selectedParty.city || 'N/A'}</div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Billing Mode <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setBillingMode('CONSOLIDATED');
                  }}
                  className={`px-3 py-2 text-xs font-medium rounded-md border text-center transition-colors cursor-pointer ${
                    billingMode === 'CONSOLIDATED'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Consolidated
                  <span className="block text-[10px] text-gray-500 font-normal mt-0.5">Multiple trips per bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBillingMode('INDIVIDUAL');
                    if (selectedTripIds.length > 1) {
                      setSelectedTripIds(selectedTripIds.slice(0, 1));
                    }
                  }}
                  className={`px-3 py-2 text-xs font-medium rounded-md border text-center transition-colors cursor-pointer ${
                    billingMode === 'INDIVIDUAL'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Individual
                  <span className="block text-[10px] text-gray-500 font-normal mt-0.5">Single trip per bill</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Eligible Unbilled Trips */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-800">2. Select Trips for Billing</h2>
            </div>
            {billingMode === 'CONSOLIDATED' && eligibleTrips.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllTrips}
                className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
              >
                {selectedTripIds.length === eligibleTrips.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {!selectedPartyId ? (
            <div className="p-8 text-center text-gray-400 text-sm bg-gray-50 rounded border border-dashed border-gray-200">
              Select a party above to discover eligible unbilled trips.
            </div>
          ) : isLoadingTrips ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
              Discovering unbilled trips with received PODs...
            </div>
          ) : isTripsError ? (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded border border-red-200">
              Failed to load eligible trips: {(tripsError as any)?.message}
            </div>
          ) : eligibleTrips.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded border border-gray-200 space-y-2">
              <p className="text-sm font-medium text-gray-700">No eligible unbilled trips found for this party.</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Trips must be in COMPLETED status and have a received POD document before they can be billed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-medium">
                    <tr>
                      <th className="w-10 px-3 py-2 text-center">Select</th>
                      <th className="px-3 py-2">Trip No.</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Vehicle</th>
                      <th className="px-3 py-2">Route</th>
                      <th className="px-3 py-2">POD Status</th>
                      <th className="px-3 py-2 text-right">Freight</th>
                      <th className="px-3 py-2 text-right">Receivable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {eligibleTrips.map((trip: EligibleTrip) => {
                      const isSelected = selectedTripIds.includes(trip.id);
                      return (
                        <tr
                          key={trip.id}
                          onClick={() => handleTripToggle(trip.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type={billingMode === 'INDIVIDUAL' ? 'radio' : 'checkbox'}
                              name="trip_selection"
                              checked={isSelected}
                              onChange={() => handleTripToggle(trip.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              aria-label={`Select trip ${trip.trip_number}`}
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-900">
                            {trip.trip_number}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {trip.trip_date}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-700">
                            {trip.vehicle_number}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {trip.route_origin} → {trip.route_destination}
                          </td>
                          <td className="px-3 py-2">
                            <span className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0.5 rounded font-medium">
                              {trip.pod_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            <AmountDisplay amount={trip.freight_amount} />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">
                            <AmountDisplay amount={trip.receivable_amount} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600 px-1">
                <span>Selected: <span className="font-semibold text-blue-600">{selectedTripIds.length}</span> of {eligibleTrips.length} trips</span>
                <span>Subtotal Receivable: <span className="font-semibold text-gray-900"><AmountDisplay amount={previewTotalReceivable} /></span></span>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Financial Year, Numbering Series & Date */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Hash className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-800">3. Document Series & Date</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Financial Year */}
            <div>
              <label htmlFor="fy-dropdown" className="block text-xs font-medium text-gray-700 mb-1">
                Financial Year <span className="text-red-500">*</span>
              </label>
              <select
                id="fy-dropdown"
                value={selectedFyId}
                onChange={(e) => setSelectedFyId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">-- Choose FY --</option>
                {financialYears.map((fy: any) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.code} ({fy.start_date.substring(0, 4)} - {fy.end_date.substring(0, 4)})
                  </option>
                ))}
              </select>
            </div>

            {/* Numbering Series */}
            <div>
              <label htmlFor="series-dropdown" className="block text-xs font-medium text-gray-700 mb-1">
                Numbering Series <span className="text-red-500">*</span>
              </label>
              <select
                id="series-dropdown"
                value={selectedSeriesId}
                onChange={(e) => setSelectedSeriesId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                disabled={!selectedPartyId || !selectedFyId}
                required
              >
                <option value="">-- Choose Series --</option>
                {numberingSeriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.series_code} — Next: {s.prefix}{s.current_number + 1}
                  </option>
                ))}
              </select>
              {selectedPartyId && selectedFyId && numberingSeriesList.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  No active numbering series found for this party in the selected FY.
                </p>
              )}
            </div>

            {/* Bill Date */}
            <div>
              <label htmlFor="bill-date-input" className="block text-xs font-medium text-gray-700 mb-1">
                Bill Date <span className="text-red-500">*</span>
              </label>
              <input
                id="bill-date-input"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                required
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            Note: Bill totals, taxes, and balance values will be authoritatively calculated by the backend upon creation.
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link to="/bills" className="w-full sm:w-auto">
              <Button type="button" variant="secondary" className="w-full sm:w-auto text-xs">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={
                generateMutation.isPending || 
                !selectedPartyId || 
                selectedTripIds.length === 0 || 
                !selectedSeriesId ||
                !selectedFyId
              }
              className="w-full sm:w-auto text-xs py-2 px-6"
            >
              {generateMutation.isPending ? 'Generating Bill...' : 'Generate Bill'}
            </Button>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}
