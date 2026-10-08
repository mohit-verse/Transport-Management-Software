import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '../components/PageContainer';
import { OwnFleetForm } from '../components/OwnFleetForm';
import { getOwnFleetVehicle, updateOwnFleetVehicle } from '../services/api';

export default function EditOwnFleet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['own-fleet', id],
    queryFn: () => getOwnFleetVehicle(id!),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => updateOwnFleetVehicle(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['own-fleet'] });
      queryClient.invalidateQueries({ queryKey: ['own-fleet', id] });
      navigate(`/own-fleet/${id}`);
    },
  });

  if (isLoading) return <PageContainer title="Edit Own Fleet Vehicle">Loading...</PageContainer>;
  if (isError || !data?.data) return <PageContainer title="Edit Own Fleet Vehicle">Error loading vehicle details</PageContainer>;

  return (
    <PageContainer title="Edit Own Fleet Vehicle">
      <div className="max-w-2xl">
        <OwnFleetForm
          initialData={data.data}
          onSubmit={async (formData) => {
            await mutation.mutateAsync(formData);
          }}
          isLoading={mutation.isPending}
          onCancel={() => navigate(`/own-fleet/${id}`)}
        />
        {mutation.isError && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
            Failed to update vehicle: {(mutation.error as any).message}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
