
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '../components/PageContainer';
import { MarketVehicleForm } from '../components/MarketVehicleForm';
import { getMarketVehicle, updateMarketVehicle } from '../services/api';

export default function EditMarketVehicle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['market-vehicles', id],
    queryFn: () => getMarketVehicle(id!),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => updateMarketVehicle(id!, data),
    onSuccess: () => {
      alert('Market vehicle updated successfully');
      queryClient.invalidateQueries({ queryKey: ['market-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['market-vehicles', id] });
      navigate('/market-vehicles');
    },
    onError: (error: any) => {
      alert(error?.response?.data?.message || 'Failed to update market vehicle');
    },
  });

  if (isLoading) return <PageContainer title="Edit Market Vehicle">Loading...</PageContainer>;
  if (isError) return <PageContainer title="Edit Market Vehicle">Error: {(error as any).message}</PageContainer>;

  return (
    <PageContainer title="Edit Market Vehicle">
      <MarketVehicleForm
        initialData={data?.data}
        onSubmit={async (formData) => {
          await mutation.mutateAsync(formData);
        }}
        isLoading={mutation.isPending}
        onCancel={() => navigate('/market-vehicles')}
      />
    </PageContainer>
  );
}
