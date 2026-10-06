import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Button } from '../Button';
import { Input } from '../Input';

export interface TripFormData {
  trip_type: 'COMPANY' | 'MARKET';
  vehicle_relationship: 'MARKET' | 'OWN_FLEET';
  party_id: string;
  vehicle_owner_id: string;
  market_vehicle_id: string;
  own_fleet_vehicle_id: string;
  driver_name: string;
  driver_mobile_number: string;
  trip_date: string;
  loading_date: string;
  unloading_date: string;
  origin: string;
  destination: string;
  lr_number: string;
  invoice_number: string;
  destinations: { id?: string; from_location: string; to_location: string; distance_km?: number }[];
  // Financials
  freight_amount?: number;
  detention_amount?: number;
  tds_amount?: number;
}

interface TripFormProps {
  initialData?: Partial<TripFormData>;
  isEditMode?: boolean;
  onSubmit: (data: TripFormData) => void;
  isLoading?: boolean;
}

export const TripForm: React.FC<TripFormProps> = ({ initialData, isEditMode, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<TripFormData>(() => ({
    trip_type: initialData?.trip_type || 'MARKET',
    vehicle_relationship: initialData?.vehicle_relationship || 'MARKET',
    party_id: initialData?.party_id || '',
    vehicle_owner_id: initialData?.vehicle_owner_id || '',
    market_vehicle_id: initialData?.market_vehicle_id || '',
    own_fleet_vehicle_id: initialData?.own_fleet_vehicle_id || '',
    driver_name: initialData?.driver_name || '',
    driver_mobile_number: initialData?.driver_mobile_number || '',
    trip_date: initialData?.trip_date || new Date().toISOString().split('T')[0],
    loading_date: initialData?.loading_date || '',
    unloading_date: initialData?.unloading_date || '',
    origin: initialData?.origin || '',
    destination: initialData?.destination || '',
    lr_number: initialData?.lr_number || '',
    invoice_number: initialData?.invoice_number || '',
    destinations: initialData?.destinations?.length ? initialData.destinations : [{ from_location: '', to_location: '' }],
    freight_amount: initialData?.freight_amount || 0,
    detention_amount: initialData?.detention_amount || 0,
    tds_amount: initialData?.tds_amount || 0,
  }));

  const { data: parties = [] } = useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      const res = await api.get('/api/parties');
      return res.data.data;
    }
  });

  const { data: marketVehicles = [] } = useQuery({
    queryKey: ['market-vehicles'],
    queryFn: async () => {
      const res = await api.get('/api/market-vehicles');
      return res.data.data;
    }
  });

  const { data: ownFleet = [] } = useQuery({
    queryKey: ['own-fleet'],
    queryFn: async () => {
      const res = await api.get('/api/own-fleet');
      return res.data.data;
    }
  });
  
  const { data: vehicleOwners = [] } = useQuery({
    queryKey: ['vehicle-owners'],
    queryFn: async () => {
      const res = await api.get('/api/vehicle-owners');
      return res.data.data;
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDestinationChange = (index: number, field: string, value: string) => {
    const newDest = [...formData.destinations];
    newDest[index] = { ...newDest[index], [field]: value };
    setFormData(prev => ({ ...prev, destinations: newDest }));
  };

  const addDestination = () => {
    setFormData(prev => ({ ...prev, destinations: [...prev.destinations, { from_location: '', to_location: '' }] }));
  };

  const removeDestination = (index: number) => {
    setFormData(prev => ({ ...prev, destinations: prev.destinations.filter((_, i) => i !== index) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg shadow border border-gray-200">
      
      {/* Classification */}
      <section>
        <h3 className="text-lg font-medium mb-4">Trip Classification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="trip_type" className="block text-sm font-medium text-gray-700 mb-1">Trip Type</label>
            <select
              id="trip_type"
              name="trip_type"
              value={formData.trip_type}
              onChange={handleChange}
              disabled={isEditMode}
              className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
            >
              <option value="MARKET">Market</option>
              <option value="COMPANY">Company</option>
            </select>
          </div>
          <div>
            <label htmlFor="vehicle_relationship" className="block text-sm font-medium text-gray-700 mb-1">Vehicle Relationship</label>
            <select
              id="vehicle_relationship"
              name="vehicle_relationship"
              value={formData.vehicle_relationship}
              onChange={handleChange}
              disabled={isEditMode}
              className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
            >
              <option value="MARKET">Market</option>
              <option value="OWN_FLEET">Own Fleet</option>
            </select>
          </div>
        </div>
      </section>

      {/* Structural Fields */}
      <section>
        <h3 className="text-lg font-medium mb-4">Party & Vehicle</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="party_id" className="block text-sm font-medium text-gray-700 mb-1">Party / Company *</label>
            <select
              id="party_id"
              name="party_id"
              value={formData.party_id}
              onChange={handleChange}
              disabled={isEditMode}
              required
              className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
            >
              <option value="">Select Party</option>
              {parties.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {formData.vehicle_relationship === 'MARKET' ? (
            <>
              <div>
                <label htmlFor="vehicle_owner_id" className="block text-sm font-medium text-gray-700 mb-1">Vehicle Owner</label>
                <select
                  id="vehicle_owner_id"
                  name="vehicle_owner_id"
                  value={formData.vehicle_owner_id}
                  onChange={handleChange}
                  disabled={isEditMode}
                  className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
                >
                  <option value="">Select Owner</option>
                  {vehicleOwners.map((vo: any) => (
                    <option key={vo.id} value={vo.id}>{vo.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="market_vehicle_id" className="block text-sm font-medium text-gray-700 mb-1">Market Vehicle</label>
                <select
                  id="market_vehicle_id"
                  name="market_vehicle_id"
                  value={formData.market_vehicle_id}
                  onChange={handleChange}
                  disabled={isEditMode}
                  className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
                >
                  <option value="">Select Vehicle</option>
                  {marketVehicles.map((mv: any) => (
                    <option key={mv.id} value={mv.id}>{mv.vehicle_number}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="own_fleet_vehicle_id" className="block text-sm font-medium text-gray-700 mb-1">Own Fleet Vehicle</label>
              <select
                id="own_fleet_vehicle_id"
                name="own_fleet_vehicle_id"
                value={formData.own_fleet_vehicle_id}
                onChange={handleChange}
                disabled={isEditMode}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
              >
                <option value="">Select Vehicle</option>
                {ownFleet.map((of: any) => (
                  <option key={of.id} value={of.id}>{of.vehicle_number}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Operational Core Fields */}
      <section>
        <h3 className="text-lg font-medium mb-4">Operational Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="Driver Name" name="driver_name" value={formData.driver_name} onChange={handleChange} />
          <Input label="Driver Mobile" name="driver_mobile_number" value={formData.driver_mobile_number} onChange={handleChange} />
          <Input label="Trip Date *" name="trip_date" type="date" value={formData.trip_date} onChange={handleChange} required />
          <Input label="Loading Date" name="loading_date" type="date" value={formData.loading_date} onChange={handleChange} />
          <Input label="Unloading Date" name="unloading_date" type="date" value={formData.unloading_date} onChange={handleChange} />
          <Input label="LR Number" name="lr_number" value={formData.lr_number} onChange={handleChange} />
          <Input label="Invoice Number" name="invoice_number" value={formData.invoice_number} onChange={handleChange} />
          <Input label="Primary Origin" name="origin" value={formData.origin} onChange={handleChange} />
          <Input label="Primary Destination" name="destination" value={formData.destination} onChange={handleChange} />
        </div>
      </section>

      {/* Destinations Array */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Destinations (Route)</h3>
          <Button type="button" onClick={addDestination} variant="secondary" size="sm">Add Leg</Button>
        </div>
        <div className="space-y-4">
          {formData.destinations.map((dest, idx) => (
            <div key={dest.id || idx} className="flex items-center gap-4 border p-4 rounded-md relative">
              <div className="flex-1">
                <Input label="From" name={`dest_${idx}_from`} value={dest.from_location} onChange={(e) => handleDestinationChange(idx, 'from_location', e.target.value)} required />
              </div>
              <div className="flex-1">
                <Input label="To" name={`dest_${idx}_to`} value={dest.to_location} onChange={(e) => handleDestinationChange(idx, 'to_location', e.target.value)} required />
              </div>
              {formData.destinations.length > 1 && (
                <button type="button" onClick={() => removeDestination(idx)} className="text-red-500 hover:text-red-700 self-end mb-2">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Financials (Edit Only or Allow always per instruction?) */}
      {isEditMode && (
        <section>
          <h3 className="text-lg font-medium mb-4">Financials</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Freight Amount" name="freight_amount" type="number" value={formData.freight_amount?.toString()} onChange={handleChange} />
            <Input label="Detention Amount" name="detention_amount" type="number" value={formData.detention_amount?.toString()} onChange={handleChange} />
            <Input label="TDS Amount" name="tds_amount" type="number" value={formData.tds_amount?.toString()} onChange={handleChange} />
          </div>
        </section>
      )}

      <div className="flex justify-end gap-4 mt-6">
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Trip'}</Button>
      </div>
    </form>
  );
};
