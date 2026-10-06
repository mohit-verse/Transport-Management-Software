import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/PageContainer';
import { TripForm } from '../components/trips/TripForm';
import type { TripFormData } from '../components/trips/TripForm';
import api from '../services/api';

const CreateTrip: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (data: TripFormData) => {
    setIsLoading(true);
    setError('');
    try {
      // 1. Create the trip
      const createPayload = {
        trip_type: data.trip_type,
        vehicle_relationship: data.vehicle_relationship,
        party_id: data.party_id,
        vehicle_owner_id: data.vehicle_owner_id || null,
        market_vehicle_id: data.market_vehicle_id || null,
        own_fleet_vehicle_id: data.own_fleet_vehicle_id || null,
        driver_name: data.driver_name,
        driver_mobile: data.driver_mobile_number,
        trip_date: data.trip_date,
        destinations: data.destinations.map(d => ({
          origin: d.from_location,
          destination: d.to_location,
        })),
      };

      const res = await api.post('/api/trips', createPayload);
      const newTripId = res.data.data.id;

      // 2. Patch the additional operational fields if present
      const patchPayload: Record<string, any> = {};
      if (data.loading_date) patchPayload.loading_date = data.loading_date;
      if (data.unloading_date) patchPayload.unloading_date = data.unloading_date;
      if (data.lr_number) patchPayload.lr_number = data.lr_number;
      if (data.invoice_number) patchPayload.invoice_number = data.invoice_number;
      if (data.origin) patchPayload.origin = data.origin;
      if (data.destination) patchPayload.destination = data.destination;

      if (Object.keys(patchPayload).length > 0) {
        await api.patch(`/api/trips/${newTripId}`, patchPayload);
      }

      navigate(`/trips`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create trip');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer title="New Trip">
      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}
      <TripForm onSubmit={handleSubmit} isLoading={isLoading} isEditMode={false} />
    </PageContainer>
  );
};

export default CreateTrip;
