import React, { useState } from 'react';

interface OwnFleetFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

export const OwnFleetForm: React.FC<OwnFleetFormProps> = ({ initialData, onSubmit, isLoading, onCancel }) => {
  const [vehicleNumber, setVehicleNumber] = useState(initialData?.vehicle_number || '');
  const [vehicleType, setVehicleType] = useState(initialData?.vehicle_type || '');
  const [capacityTonnage, setCapacityTonnage] = useState(initialData?.capacity_tonnage?.toString() || '');
  const [purchaseDate, setPurchaseDate] = useState(
    initialData?.purchase_date ? new Date(initialData.purchase_date).toISOString().split('T')[0] : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      vehicle_number: vehicleNumber,
      vehicle_type: vehicleType,
      capacity_tonnage: capacityTonnage ? parseFloat(capacityTonnage) : undefined,
      purchase_date: purchaseDate ? new Date(purchaseDate).toISOString() : undefined,
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
        <label htmlFor="vehicleType" className="block text-sm font-medium text-gray-700">Vehicle Type *</label>
        <input
          id="vehicleType"
          type="text"
          required
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
        />
      </div>

      <div>
        <label htmlFor="capacityTonnage" className="block text-sm font-medium text-gray-700">Capacity (Tonnage) *</label>
        <input
          id="capacityTonnage"
          type="number"
          step="0.01"
          required
          value={capacityTonnage}
          onChange={(e) => setCapacityTonnage(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
        />
      </div>

      <div>
        <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">Purchase Date</label>
        <input
          id="purchaseDate"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
        />
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isLoading || !vehicleNumber || !vehicleType || !capacityTonnage}
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
