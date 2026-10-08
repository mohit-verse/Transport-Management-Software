import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getParty, 
  getPartyFinancials, 
  getPartyTrips, 
  getPartyBills, 
  getPartyPayments, 
  updatePartyBillingConfig 
} from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function PartyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);

  const { data: partyData, isLoading: partyLoading } = useQuery({
    queryKey: ['party', id],
    queryFn: () => getParty(id!),
    enabled: !!id,
  });

  const { data: financialsData, isLoading: finLoading } = useQuery({
    queryKey: ['party-financials', id],
    queryFn: () => getPartyFinancials(id!),
    enabled: !!id,
  });

  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ['party-trips', id],
    queryFn: () => getPartyTrips(id!),
    enabled: !!id,
  });

  const { data: billsData, isLoading: billsLoading } = useQuery({
    queryKey: ['party-bills', id],
    queryFn: () => getPartyBills(id!),
    enabled: !!id,
  });

  const { data: paymentsData, isLoading: payLoading } = useQuery({
    queryKey: ['party-payments', id],
    queryFn: () => getPartyPayments(id!),
    enabled: !!id,
  });

  const [billingConfigJson, setBillingConfigJson] = useState('');
  const [isEditingBilling, setIsEditingBilling] = useState(false);

  const updateBillingMutation = useMutation({
    mutationFn: (config: any) => updatePartyBillingConfig(id!, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party', id] });
      setIsEditingBilling(false);
    }
  });

  if (partyLoading || finLoading || tripsLoading || billsLoading || payLoading) {
    return <div className="p-6">Loading details...</div>;
  }

  const party = partyData?.data;
  if (!party) {
    return <div className="p-6 text-red-500">Party not found</div>;
  }

  const financials = financialsData?.data || {};
  const trips = tripsData?.data || [];
  const bills = billsData?.data || [];
  const payments = paymentsData?.data || [];

  const handleEditBilling = () => {
    setBillingConfigJson(JSON.stringify(party.billing_configuration || {}, null, 2));
    setIsEditingBilling(true);
  };

  const handleSaveBilling = () => {
    try {
      const config = JSON.parse(billingConfigJson);
      updateBillingMutation.mutate(config);
    } catch (e) {
      alert("Invalid JSON format");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{party.name}</h1>
        <div className="space-x-3">
          <button 
            onClick={() => navigate('/parties')}
            className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50"
          >
            Back
          </button>
          {user?.role !== 'CA' && (
            <button 
              onClick={() => navigate(`/parties/${id}/edit`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Edit Master Info
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Master Information */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Master Information</h2>
          <div className="space-y-3">
            <p><span className="font-medium text-gray-600">Type:</span> {party.party_type}</p>
            <p><span className="font-medium text-gray-600">Mobile:</span> {party.primary_mobile}</p>
            <p><span className="font-medium text-gray-600">Address:</span> {party.address}, {party.city}, {party.state} - {party.pin_code}</p>
            <p><span className="font-medium text-gray-600">GSTIN:</span> {party.gstin || 'N/A'}</p>
            <p><span className="font-medium text-gray-600">PAN:</span> {party.pan_number || 'N/A'}</p>
            <p><span className="font-medium text-gray-600">TDS Applicable:</span> {party.is_tds_applicable ? 'Yes' : 'No'}</p>
          </div>
        </div>

        {/* Financial Position */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Financial Position</h2>
          <div className="space-y-3">
            <p><span className="font-medium text-gray-600">Current Balance:</span> <span className={financials.current_balance >= 0 ? "text-green-600" : "text-red-600"}>₹{financials.current_balance || 0}</span></p>
            <p><span className="font-medium text-gray-600">Total Billed:</span> ₹{financials.total_billed || 0}</p>
            <p><span className="font-medium text-gray-600">Total Paid:</span> ₹{financials.total_paid || 0}</p>
            <p><span className="font-medium text-gray-600">Outstanding:</span> ₹{financials.outstanding || 0}</p>
            <p><span className="font-medium text-gray-600">Credit Available:</span> ₹{financials.credit || 0}</p>
          </div>
        </div>
      </div>

      {/* TDS Information */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">TDS Information</h2>
        <div className="space-y-3">
          <p><span className="font-medium text-gray-600">TDS Applicable:</span> {party.is_tds_applicable ? 'Yes' : 'No'}</p>
          {party.is_tds_applicable && (
            <>
              <p><span className="font-medium text-gray-600">Total TDS Deducted:</span> ₹{financials.total_tds || 0}</p>
            </>
          )}
        </div>
      </div>

      {/* Billing Configuration */}
      {party.party_type === 'COMPANY' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xl font-semibold">Billing Configuration</h2>
            {user?.role === 'OWNER' && !isEditingBilling && (
              <button 
                onClick={handleEditBilling}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Edit Config
              </button>
            )}
          </div>
          {isEditingBilling ? (
            <div className="space-y-4">
              <textarea 
                className="w-full h-32 p-2 border rounded font-mono text-sm"
                value={billingConfigJson}
                onChange={(e) => setBillingConfigJson(e.target.value)}
              />
              <div className="flex space-x-2">
                <button 
                  onClick={handleSaveBilling}
                  disabled={updateBillingMutation.isPending}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Save
                </button>
                <button 
                  onClick={() => setIsEditingBilling(false)}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(party.billing_configuration || {}, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Tables for Trips, Bills, Payments */}
      <div className="grid grid-cols-1 gap-6">
        {/* Trip Position */}
        <div className="bg-white p-6 rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Trip Position (Recent)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">LR Number</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Vehicle</th>
                  <th className="px-4 py-2 text-left">Route</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {trips.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-3 text-center text-gray-500">No trips found</td></tr>
                ) : (
                  trips.slice(0, 5).map((t: any) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2">{t.lr_number}</td>
                      <td className="px-4 py-2">{new Date(t.start_date || t.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2">{t.vehicle?.vehicle_number || t.vehicle_id}</td>
                      <td className="px-4 py-2">{t.route?.origin} to {t.route?.destination}</td>
                      <td className="px-4 py-2">{t.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill Position */}
        <div className="bg-white p-6 rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Bill Position</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Bill Number</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bills.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-500">No bills found</td></tr>
                ) : (
                  bills.map((b: any) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2">{b.bill_number}</td>
                      <td className="px-4 py-2">{new Date(b.bill_date || b.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2">₹{b.total_amount}</td>
                      <td className="px-4 py-2">{b.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Activity */}
        <div className="bg-white p-6 rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Payment Activity</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Payment ID</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-left">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-3 text-center text-gray-500">No payments found</td></tr>
                ) : (
                  payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2">{p.id.slice(0, 8)}...</td>
                      <td className="px-4 py-2">{new Date(p.payment_date || p.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-green-600 font-medium">₹{p.amount}</td>
                      <td className="px-4 py-2">{p.payment_mode}</td>
                      <td className="px-4 py-2">{p.reference_number || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
