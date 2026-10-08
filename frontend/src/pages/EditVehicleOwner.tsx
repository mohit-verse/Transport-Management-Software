import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVehicleOwner, updateVehicleOwner } from '../services/api';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

export default function EditVehicleOwner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['vehicleOwner', id],
    queryFn: () => getVehicleOwner(id!),
    enabled: !!id,
  });

  const [formData, setFormData] = useState({
    name: '',
    mobile_number: '',
    address: '',
    city: '',
    state: '',
    pan_number: '',
    bank_details: {
      account_name: '',
      account_number: '',
      ifsc_code: '',
      bank_name: '',
    },
  });

  useEffect(() => {
    if (response?.data) {
      const { data } = response;
      setFormData({
        name: data.name || '',
        mobile_number: data.mobile_number || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pan_number: data.pan_number || '',
        bank_details: data.bank_details || {
          account_name: '',
          account_number: '',
          ifsc_code: '',
          bank_name: '',
        },
      });
    }
  }, [response]);

  const mutation = useMutation({
    mutationFn: (data: any) => updateVehicleOwner(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleOwners'] });
      queryClient.invalidateQueries({ queryKey: ['vehicleOwner', id] });
      navigate(`/vehicle-owners/${id}`);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('bank_')) {
      const bankField = name.replace('bank_', '');
      setFormData((prev) => ({
        ...prev,
        bank_details: {
          ...prev.bank_details,
          [bankField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) {
    return <PageContainer title="Edit Vehicle Owner">Loading...</PageContainer>;
  }

  if (error || !response?.data) {
    return <PageContainer title="Edit Vehicle Owner">Error loading vehicle owner</PageContainer>;
  }

  return (
    <PageContainer title="Edit Vehicle Owner" actions={<Link to={`/vehicle-owners/${id}`} className="text-gray-600 hover:underline">Back</Link>}>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white p-6 rounded-lg border space-y-4">
          <h2 className="text-lg font-medium">Basic Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <Input
              label="Mobile Number"
              name="mobile_number"
              value={formData.mobile_number}
              onChange={handleChange}
              required
            />
            <Input
              label="PAN Number"
              name="pan_number"
              value={formData.pan_number}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border space-y-4">
          <h2 className="text-lg font-medium">Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            <Input
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
            />
            <Input
              label="State"
              name="state"
              value={formData.state}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border space-y-4">
          <h2 className="text-lg font-medium">Bank Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Account Name"
              name="bank_account_name"
              value={formData.bank_details.account_name}
              onChange={handleChange}
            />
            <Input
              label="Account Number"
              name="bank_account_number"
              value={formData.bank_details.account_number}
              onChange={handleChange}
            />
            <Input
              label="IFSC Code"
              name="bank_ifsc_code"
              value={formData.bank_details.ifsc_code}
              onChange={handleChange}
            />
            <Input
              label="Bank Name"
              name="bank_bank_name"
              value={formData.bank_details.bank_name}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate(`/vehicle-owners/${id}`)}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
