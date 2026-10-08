import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '../components/PageContainer';
import { OwnFleetForm } from '../components/OwnFleetForm';
import { createOwnFleetVehicle } from '../services/api';

export default function CreateOwnFleet() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createOwnFleetVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['own-fleet'] });
      navigate('/own-fleet');
    },
  });

  return (
    <PageContainer title="Add Own Fleet Vehicle">
      <div className="max-w-2xl">
        <OwnFleetForm
          onSubmit={async (data) => {
            await mutation.mutateAsync(data);
          }}
          isLoading={mutation.isPending}
          onCancel={() => navigate('/own-fleet')}
        />
        {mutation.isError && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
            Failed to create vehicle: {(mutation.error as any).message}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
