import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '../components/PageContainer';
import { StatusBadge } from '../components/StatusBadge';
import { getMarketVehicle } from '../services/api';

export default function MarketVehicleDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['market-vehicles', id],
    queryFn: () => getMarketVehicle(id!),
    enabled: !!id,
  });

  if (isLoading) return <PageContainer title="Market Vehicle Details">Loading...</PageContainer>;
  if (isError) return <PageContainer title="Market Vehicle Details">Error: {(error as any).message}</PageContainer>;

  const vehicle = data?.data;
  if (!vehicle) return <PageContainer title="Market Vehicle Details">Vehicle not found</PageContainer>;

  const trips = vehicle.trips || [];

  return (
    <PageContainer title="Market Vehicle Details">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Vehicle Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Vehicle Number</p>
              <p className="font-medium text-gray-900">{vehicle.vehicle_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Vehicle Type</p>
              <p className="font-medium text-gray-900">{vehicle.vehicle_type || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Owner Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Owner Name</p>
              <Link to={`/vehicle-owners/${vehicle.vehicle_owner_id}`} className="font-medium text-blue-600 hover:underline">
                {vehicle.owner_name}
              </Link>
            </div>
            <div>
              <p className="text-sm text-gray-500">Mobile Number</p>
              <p className="font-medium text-gray-900">{vehicle.owner_mobile_number}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Related Trips</h2>
        </div>
        {trips.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No trips found for this vehicle.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trips.map((trip: any) => (
                <tr key={trip.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    <Link to={`/trips/${trip.id}`} className="hover:underline">{trip.trip_number}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {trip.trip_date ? new Date(trip.trip_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trip.origin} → {trip.destination}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <StatusBadge status={trip.status} />
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
