import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '../components/PageContainer';
import { MarketVehicleForm } from '../components/MarketVehicleForm';
import { createMarketVehicle } from '../services/api';

export default function CreateMarketVehicle() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createMarketVehicle,
    onSuccess: () => {
      alert('Market vehicle created successfully');
      queryClient.invalidateQueries({ queryKey: ['market-vehicles'] });
      navigate('/market-vehicles');
    },
    onError: (error: any) => {
      alert(error?.response?.data?.message || 'Failed to create market vehicle');
    },
  });

  return (
    <PageContainer title="Add Market Vehicle">
      <MarketVehicleForm
        onSubmit={async (data) => {
          await mutation.mutateAsync(data);
        }}
        isLoading={mutation.isPending}
        onCancel={() => navigate('/market-vehicles')}
      />
    </PageContainer>
  );
}
