import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Eye, Edit2 } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { useAuthStore } from '../store/authStore';
import { getOwnFleetVehicles } from '../services/api';

export default function OwnFleet() {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'OWNER' || user?.role === 'STAFF';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['own-fleet'],
    queryFn: getOwnFleetVehicles,
  });

  const actions = canEdit ? (
    <Link
      to="/own-fleet/new"
      className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
    >
      <Plus className="w-4 h-4" />
      Add Own Fleet Vehicle
    </Link>
  ) : null;

  if (isLoading) return <PageContainer title="Own Fleet" actions={actions}>Loading...</PageContainer>;
  
  if (isError) return <PageContainer title="Own Fleet" actions={actions}>Error: {(error as any).message}</PageContainer>;

  const vehicles = data?.data || [];

  return (
    <PageContainer title="Own Fleet" actions={actions}>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {vehicles.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No own fleet vehicles found.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacity (Tons)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchase Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {vehicle.vehicle_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.vehicle_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.capacity_tonnage}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.purchase_date ? new Date(vehicle.purchase_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${vehicle.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 
                        vehicle.status === 'IN_TRIP' ? 'bg-blue-100 text-blue-800' : 
                        vehicle.status === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'}`}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-3">
                      <Link
                        to={`/own-fleet/${vehicle.id}`}
                        className="text-gray-400 hover:text-blue-600"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </Link>
                      {canEdit && (
                        <Link
                          to={`/own-fleet/${vehicle.id}/edit`}
                          className="text-gray-400 hover:text-green-600"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
