import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PageContainer } from '../components/PageContainer';
import { StatusBadge } from '../components/StatusBadge';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useDebounce } from '../hooks/useDebounce';
import { useAuthStore } from '../store/authStore';

export interface Trip {
  id: string;
  trip_number: string;
  vehicle_number: string;
  driver_mobile: string;
  route_from: string;
  route_to: string;
  loading_date: string;
  unloading_date: string | null;
  trip_status: 'CREATED' | 'LOADING' | 'IN_TRANSIT' | 'COMPLETED' | 'SETTLED' | 'CANCELLED';
}

export const TripsPage = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [status, setStatus] = useState('');
  
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['trips', debouncedSearch, status],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (status) params.status = status;
      const res = await api.get('/api/trips', { params });
      return res.data.data as Trip[];
    }
  });

  const canCreate = user?.role === 'OWNER' || user?.role === 'STAFF';

  return (
    <PageContainer title="Trips">
      <div className="flex flex-col gap-4">
        {/* Top actions & filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search trips..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="h-10 rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="CREATED">Created</option>
              <option value="LOADING">Loading</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="COMPLETED">Completed</option>
              <option value="SETTLED">Settled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          {canCreate && (
            <Button onClick={() => navigate('/trips/new')} className="w-full sm:w-auto">
              Create Trip
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading && (
          <div className="py-12 text-center text-gray-500">Loading trips...</div>
        )}
        
        {isError && (
          <div className="py-12 text-center text-red-500">
            Error loading trips. {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
            No trips found.
          </div>
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip Number</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Mobile</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loading Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unloading Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((trip) => (
                    <tr 
                      key={trip.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/trips/${trip.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{trip.trip_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trip.vehicle_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trip.driver_mobile}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trip.route_from}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trip.route_to}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trip.loading_date ? new Date(trip.loading_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trip.unloading_date ? new Date(trip.unloading_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <StatusBadge status={trip.trip_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden flex flex-col gap-4">
              {data.map((trip) => (
                <div 
                  key={trip.id} 
                  className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/trips/${trip.id}`)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-blue-600">{trip.trip_number}</h3>
                      <p className="text-xs text-gray-500 mt-1">{trip.vehicle_number}</p>
                    </div>
                    <StatusBadge status={trip.trip_status} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">From</p>
                      <p className="text-sm font-medium">{trip.route_from}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">To</p>
                      <p className="text-sm font-medium">{trip.route_to}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <div>
                      <p className="text-xs text-gray-500">Driver Mobile</p>
                      <p className="text-sm">{trip.driver_mobile}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Loading Date</p>
                      <p className="text-sm">
                        {trip.loading_date ? new Date(trip.loading_date).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default TripsPage;
