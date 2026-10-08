import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getVehicleOwner,
  getVehicleOwnerFinancials,
  getVehicleOwnerVehicles,
  getVehicleOwnerTrips,
  getVehicleOwnerPayments
} from '../services/api';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { useAuthStore } from '../store/authStore';

export default function VehicleOwnerDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);

  const { data: ownerResponse, isLoading: isLoadingOwner } = useQuery({
    queryKey: ['vehicleOwner', id],
    queryFn: () => getVehicleOwner(id!),
    enabled: !!id,
  });

  const { data: financialsResponse } = useQuery({
    queryKey: ['vehicleOwnerFinancials', id],
    queryFn: () => getVehicleOwnerFinancials(id!),
    enabled: !!id,
  });

  const { data: vehiclesResponse } = useQuery({
    queryKey: ['vehicleOwnerVehicles', id],
    queryFn: () => getVehicleOwnerVehicles(id!),
    enabled: !!id,
  });

  const { data: tripsResponse } = useQuery({
    queryKey: ['vehicleOwnerTrips', id],
    queryFn: () => getVehicleOwnerTrips(id!),
    enabled: !!id,
  });

  const { data: paymentsResponse } = useQuery({
    queryKey: ['vehicleOwnerPayments', id],
    queryFn: () => getVehicleOwnerPayments(id!),
    enabled: !!id,
  });

  if (isLoadingOwner) {
    return <PageContainer title="Vehicle Owner Details">Loading...</PageContainer>;
  }

  const owner = ownerResponse?.data;
  if (!owner) {
    return <PageContainer title="Vehicle Owner Details">Owner not found</PageContainer>;
  }

  const financials = financialsResponse?.data || {};
  const vehicles = vehiclesResponse?.data || [];
  const trips = tripsResponse?.data || [];
  const payments = paymentsResponse?.data || [];

  return (
    <PageContainer
      title="Vehicle Owner Details"
      actions={
        <>
          <Link to="/vehicle-owners" className="text-gray-600 hover:underline mr-4 flex items-center">Back</Link>
          {user?.role !== 'CA' && (
            <Link to={`/vehicle-owners/${id}/edit`}>
              <Button>Edit Owner</Button>
            </Link>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {/* Owner Information */}
        <section className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-lg font-medium mb-4">Owner Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{owner.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Mobile Number</p>
              <p className="font-medium">{owner.mobile_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">PAN Number</p>
              <p className="font-medium">{owner.pan_number || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Address</p>
              <p className="font-medium">
                {[owner.address, owner.city, owner.state].filter(Boolean).join(', ') || '-'}
              </p>
            </div>
          </div>
          {owner.bank_details && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Bank Name</p>
                <p className="font-medium">{owner.bank_details.bank_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Account Number</p>
                <p className="font-medium">{owner.bank_details.account_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">IFSC Code</p>
                <p className="font-medium">{owner.bank_details.ifsc_code || '-'}</p>
              </div>
            </div>
          )}
        </section>

        {/* Financial Information */}
        <section className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-lg font-medium mb-4">Financial Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Payable</p>
              <p className="text-xl font-semibold">₹{financials.total_payable || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Amount Paid</p>
              <p className="text-xl font-semibold text-green-600">₹{financials.amount_paid || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-xl font-semibold text-red-600">₹{financials.outstanding || 0}</p>
            </div>
          </div>
        </section>

        {/* Owned Vehicles */}
        <section className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-lg font-medium mb-4">Owned Vehicles</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vehicles.length === 0 ? (
                  <tr><td colSpan={2} className="px-6 py-4 text-center text-gray-500">No vehicles associated with this owner.</td></tr>
                ) : (
                  vehicles.map((v: any, i: number) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{v.vehicle_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.vehicle_type}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Related Trips */}
        <section className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-lg font-medium mb-4">Related Trips</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LR Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trips.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No trips associated with this owner.</td></tr>
                ) : (
                  trips.map((t: any, i: number) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.lr_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.route}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Payment Information */}
        <section className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-lg font-medium mb-4">Payment Information</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Mode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No payments recorded.</td></tr>
                ) : (
                  payments.map((p: any, i: number) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{p.amount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.payment_mode}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.reference_number}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
