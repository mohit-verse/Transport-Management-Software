import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '../components/PageContainer';
import { TripForm } from '../components/trips/TripForm';
import type { TripFormData } from '../components/trips/TripForm';
import api from '../services/api';

const EditTrip: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: trip, isLoading: isFetching } = useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await api.get(`/api/trips/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: TripFormData) => {
      // 1. Update Core
      const corePayload = {
        driver_mobile_number: formData.driver_mobile_number,
        lr_number: formData.lr_number,
        invoice_number: formData.invoice_number,
        trip_date: formData.trip_date,
        loading_date: formData.loading_date || null,
        unloading_date: formData.unloading_date || null,
        origin: formData.origin,
        destination: formData.destination,
        destinations: formData.destinations.map(d => ({
          id: d.id, // preserve ID
          from_location: d.from_location,
          to_location: d.to_location,
        })),
      };

      await api.patch(`/api/trips/${id}`, corePayload);

      // 2. Update Financials
      const financialsPayload = {
        freight_amount: Number(formData.freight_amount) || 0,
        detention_amount: Number(formData.detention_amount) || 0,
        tds_amount: Number(formData.tds_amount) || 0,
      };

      await api.patch(`/api/trips/${id}/financials`, financialsPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate(`/trips/${id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || err.message || 'Failed to update trip');
    }
  });

  if (isFetching) {
    return <PageContainer title="Edit Trip"><div className="p-4">Loading trip data...</div></PageContainer>;
  }

  if (!trip) {
    return <PageContainer title="Edit Trip"><div className="p-4 text-red-500">Trip not found</div></PageContainer>;
  }

  const initialData: Partial<TripFormData> = {
    trip_type: trip.trip_type,
    vehicle_relationship: trip.vehicle_relationship,
    party_id: trip.party_id,
    vehicle_owner_id: trip.vehicle_owner_id || '',
    market_vehicle_id: trip.market_vehicle_id || '',
    own_fleet_vehicle_id: trip.own_fleet_vehicle_id || '',
    driver_name: trip.driver_name || '',
    driver_mobile_number: trip.driver_mobile_number || trip.driver_mobile || '',
    trip_date: trip.trip_date ? trip.trip_date.split('T')[0] : '',
    loading_date: trip.loading_date ? trip.loading_date.split('T')[0] : '',
    unloading_date: trip.unloading_date ? trip.unloading_date.split('T')[0] : '',
    origin: trip.origin || '',
    destination: trip.destination || '',
    lr_number: trip.lr_number || '',
    invoice_number: trip.invoice_number || '',
    destinations: trip.destinations?.map((d: any) => ({
      id: d.id,
      from_location: d.from_location,
      to_location: d.to_location,
      distance_km: d.distance_km,
    })) || [],
    freight_amount: trip.freight_amount || 0,
    detention_amount: trip.detention_amount || 0,
    tds_amount: trip.tds_amount || 0,
  };

  return (
    <PageContainer title="Edit Trip">
      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}
      <TripForm 
        initialData={initialData} 
        onSubmit={(data) => { setError(''); updateMutation.mutate(data); }} 
        isLoading={updateMutation.isPending} 
        isEditMode={true} 
      />
    </PageContainer>
  );
};

export default EditTrip;
