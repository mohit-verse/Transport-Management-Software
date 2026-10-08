import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createParty, type Party } from '../services/api';

export default function CreateParty() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<Partial<Party>>({
    party_type: 'COMPANY',
    name: '',
    primary_mobile: '',
    address: '',
    city: '',
    state: '',
    pin_code: '',
    gstin: '',
    pan_number: '',
    is_tds_applicable: false,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => createParty(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      navigate('/parties');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // If we need to send billing address, we can wrap it in billing_configuration or similar
    const payload = {
      ...formData,
      // If billing configuration isn't strictly validated on create, or if it is ignored, we send it anyway
    };
    mutation.mutate(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add New Party</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Party Type</label>
          <select 
            name="party_type" 
            value={formData.party_type} 
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
          >
            <option value="COMPANY">Company</option>
            <option value="MARKET_PARTY">Market Party</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input 
            type="text" 
            name="name" 
            value={formData.name} 
            onChange={handleChange} 
            required 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Primary Mobile</label>
          <input 
            type="text" 
            name="primary_mobile" 
            value={formData.primary_mobile} 
            onChange={handleChange} 
            required 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Full Address</label>
          <input 
            type="text" 
            name="address" 
            value={formData.address} 
            onChange={handleChange} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">City</label>
            <input 
              type="text" 
              name="city" 
              value={formData.city} 
              onChange={handleChange} 
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">State</label>
            <input 
              type="text" 
              name="state" 
              value={formData.state} 
              onChange={handleChange} 
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">PIN Code</label>
            <input 
              type="text" 
              name="pin_code" 
              value={formData.pin_code} 
              onChange={handleChange} 
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">GSTIN</label>
          <input 
            type="text" 
            name="gstin" 
            value={formData.gstin} 
            onChange={handleChange} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">PAN Number</label>
          <input 
            type="text" 
            name="pan_number" 
            value={formData.pan_number} 
            onChange={handleChange} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
          />
        </div>
        
        <div>
          <label className="flex items-center mt-4">
            <input 
              type="checkbox" 
              name="is_tds_applicable" 
              checked={formData.is_tds_applicable} 
              onChange={handleChange} 
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 h-5 w-5" 
            />
            <span className="ml-2 text-sm text-gray-700">TDS Applicable</span>
          </label>
        </div>

        <div className="pt-4 flex justify-end space-x-2">
          <button 
            type="button" 
            onClick={() => navigate('/parties')} 
            className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Party'}
          </button>
        </div>
      </form>
    </div>
  );
}
