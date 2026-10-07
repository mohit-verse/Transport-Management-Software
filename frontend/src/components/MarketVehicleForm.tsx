import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVehicleOwners } from '../services/api';

interface MarketVehicleFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

export const MarketVehicleForm: React.FC<MarketVehicleFormProps> = ({ initialData, onSubmit, isLoading, onCancel }) => {
  const [vehicleNumber, setVehicleNumber] = useState(initialData?.vehicle_number || '');
  const [vehicleType, setVehicleType] = useState(initialData?.vehicle_type || '');
  const [vehicleOwnerId, setVehicleOwnerId] = useState(initialData?.vehicle_owner_id || '');

  const { data: ownersData, isLoading: ownersLoading, isError: ownersError } = useQuery({
    queryKey: ['vehicle-owners'],
    queryFn: getVehicleOwners,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      vehicle_number: vehicleNumber,
      vehicle_type: vehicleType,
      vehicle_owner_id: vehicleOwnerId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg bg-white p-6 rounded-lg shadow">
      <div>
        <label htmlFor="vehicleNumber" className="block text-sm font-medium text-gray-700">Vehicle Number *</label>
        <input
          id="vehicleNumber"
          type="text"
          required
          value={vehicleNumber}
          onChange={(e) => setVehicleNumber(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
        />
      </div>

      <div>
        <label htmlFor="vehicleType" className="block text-sm font-medium text-gray-700">Vehicle Type</label>
        <input
          id="vehicleType"
          type="text"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
        />
      </div>

      <div>
        <label htmlFor="vehicleOwnerId" className="block text-sm font-medium text-gray-700">Vehicle Owner *</label>
        {ownersLoading ? (
          <p className="text-sm text-gray-500 mt-1">Loading owners...</p>
        ) : ownersError ? (
          <p className="text-sm text-red-500 mt-1">Failed to load owners</p>
        ) : (
          <select
            id="vehicleOwnerId"
            required
            value={vehicleOwnerId}
            onChange={(e) => setVehicleOwnerId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
          >
            <option value="" disabled>Select an owner</option>
            {ownersData?.data?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.mobile_number})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isLoading || !vehicleNumber || !vehicleOwnerId}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
