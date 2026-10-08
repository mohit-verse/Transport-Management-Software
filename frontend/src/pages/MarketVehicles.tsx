
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Eye, Edit2 } from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { useAuthStore } from '../store/authStore';
import { getMarketVehicles } from '../services/api';

export default function MarketVehicles() {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'OWNER' || user?.role === 'STAFF';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['market-vehicles'],
    queryFn: getMarketVehicles,
  });

  const actions = canEdit ? (
    <Link
      to="/market-vehicles/new"
      className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
    >
      <Plus className="w-4 h-4" />
      Add Market Vehicle
    </Link>
  ) : null;

  if (isLoading) return <PageContainer title="Market Vehicles" actions={actions}>Loading...</PageContainer>;
  
  if (isError) return <PageContainer title="Market Vehicles" actions={actions}>Error: {(error as any).message}</PageContainer>;

  const vehicles = data?.data || [];

  return (
    <PageContainer title="Market Vehicles" actions={actions}>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {vehicles.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No market vehicles found.</div>
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
                  Owner Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner Mobile
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
                    {vehicle.vehicle_type || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <Link to={`/vehicle-owners/${vehicle.vehicle_owner_id}`} className="text-blue-600 hover:underline">
                      {vehicle.owner_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.owner_mobile_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-3">
                      <Link
                        to={`/market-vehicles/${vehicle.id}`}
                        className="text-gray-400 hover:text-blue-600"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </Link>
                      {canEdit && (
                        <Link
                          to={`/market-vehicles/${vehicle.id}/edit`}
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
