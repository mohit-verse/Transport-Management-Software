import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getVehicleOwners } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function VehicleOwners() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicleOwners'],
    queryFn: getVehicleOwners
  });

  if (isLoading) return <div className="p-4">Loading vehicle owners...</div>;
  if (error) return <div className="p-4 text-red-500">Error loading vehicle owners</div>;

  const owners = data?.data || [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Vehicle Owners</h1>
        {user?.role !== 'CA' && (
          <button
            onClick={() => navigate('/vehicle-owners/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Add Vehicle Owner
          </button>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owned Vehicles</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Payable</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {owners.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">No vehicle owners found</td>
              </tr>
            ) : (
              owners.map((owner: any) => (
                <tr key={owner.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{owner.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{owner.mobile_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {Array.isArray(owner.vehicles) ? owner.vehicles.map((v: any) => v.vehicle_number || v).join(', ') : (owner.vehicles || '-')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {owner.outstanding !== undefined ? `₹${owner.outstanding}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {owner.total_payable !== undefined ? `₹${owner.total_payable}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {owner.amount_paid !== undefined ? `₹${owner.amount_paid}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => navigate(`/vehicle-owners/${owner.id}`)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      View
                    </button>
                    {user?.role !== 'CA' && (
                      <button
                        onClick={() => navigate(`/vehicle-owners/${owner.id}/edit`)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
