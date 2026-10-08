import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '../components/PageContainer';
import { 
  getOwnFleetVehicle, 
  getOwnFleetTrips, 
  getOwnFleetExpenses, 
  setOwnFleetMaintenance, 
  setOwnFleetSold, 
  getDocuments,
  uploadOwnFleetDocument
} from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function OwnFleetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);
  
  const canEdit = user?.role === 'OWNER' || user?.role === 'STAFF';
  const canUpload = user?.role === 'OWNER' || user?.role === 'STAFF';
  const canMarkSold = user?.role === 'OWNER';

  const { data: vehicleData, isLoading: vehicleLoading } = useQuery({
    queryKey: ['own-fleet', id],
    queryFn: () => getOwnFleetVehicle(id!),
    enabled: !!id,
  });

  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ['own-fleet-trips', id],
    queryFn: () => getOwnFleetTrips(id!),
    enabled: !!id,
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['own-fleet-expenses', id],
    queryFn: () => getOwnFleetExpenses(id!),
    enabled: !!id,
  });

  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', 'own_fleet', id],
    queryFn: () => getDocuments({ entity_type: 'own_fleet', entity_id: id }),
    enabled: !!id,
  });

  const maintenanceMutation = useMutation({
    mutationFn: () => setOwnFleetMaintenance(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['own-fleet', id] });
    }
  });

  const soldMutation = useMutation({
    mutationFn: () => setOwnFleetSold(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['own-fleet', id] });
    }
  });

  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  
  const uploadDocMutation = useMutation({
    mutationFn: (formData: FormData) => uploadOwnFleetDocument(id!, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'own_fleet', id] });
      setDocFile(null);
      setDocType('');
      setDocExpiry('');
    }
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;
    const formData = new FormData();
    formData.append('file', docFile);
    formData.append('document_type', docType);
    if (docExpiry) formData.append('expiry_date', docExpiry);
    
    uploadDocMutation.mutate(formData);
  };

  if (vehicleLoading || tripsLoading || expensesLoading || docsLoading) {
    return <PageContainer title="Vehicle Details">Loading...</PageContainer>;
  }

  const vehicle = vehicleData?.data;
  if (!vehicle) {
    return <PageContainer title="Vehicle Details">Vehicle not found</PageContainer>;
  }

  const trips = tripsData?.data || [];
  const expenses = expensesData?.data || [];
  const documents = documentsData?.data || [];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{vehicle.vehicle_number}</h1>
        <div className="space-x-3">
          <button 
            onClick={() => navigate('/own-fleet')}
            className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50"
          >
            Back
          </button>
          {canEdit && vehicle.status !== 'SOLD' && (
            <>
              {vehicle.status !== 'MAINTENANCE' && (
                <button 
                  onClick={() => maintenanceMutation.mutate()}
                  disabled={maintenanceMutation.isPending}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                >
                  Mark as Maintenance
                </button>
              )}
              {canMarkSold && (
                <button 
                  onClick={() => soldMutation.mutate()}
                  disabled={soldMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Mark as Sold
                </button>
              )}
              <button 
                onClick={() => navigate(`/own-fleet/${id}/edit`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Edit Info
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Vehicle Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <p><span className="font-medium text-gray-600">Type:</span> {vehicle.vehicle_type}</p>
          <p><span className="font-medium text-gray-600">Capacity:</span> {vehicle.capacity_tonnage} Tons</p>
          <p><span className="font-medium text-gray-600">Purchase Date:</span> {vehicle.purchase_date ? new Date(vehicle.purchase_date).toLocaleDateString() : 'N/A'}</p>
          <p>
            <span className="font-medium text-gray-600">Status:</span>{' '}
            <span className={`px-2 py-1 text-xs font-semibold rounded-full 
              ${vehicle.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 
                vehicle.status === 'IN_TRIP' ? 'bg-blue-100 text-blue-800' : 
                vehicle.status === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'}`}>
              {vehicle.status}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Recent Trips</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">LR Number</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Route</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {trips.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-500">No trips found</td></tr>
                ) : (
                  trips.map((t: any) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2">{t.lr_number}</td>
                      <td className="px-4 py-2">{new Date(t.start_date || t.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2">{t.route?.origin} to {t.route?.destination}</td>
                      <td className="px-4 py-2">{t.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Expenses</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expenses.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-500">No expenses found</td></tr>
                ) : (
                  expenses.map((e: any) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2">{new Date(e.expense_date || e.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2">{e.expense_type}</td>
                      <td className="px-4 py-2">₹{e.amount}</td>
                      <td className="px-4 py-2">{e.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Expiry</th>
                  <th className="px-4 py-2 text-left">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {documents.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-3 text-center text-gray-500">No documents found</td></tr>
                ) : (
                  documents.map((d: any) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2">{d.document_type}</td>
                      <td className="px-4 py-2">
                        {d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : 'N/A'}
                        {d.expiry_date && new Date(d.expiry_date) < new Date() && (
                          <span className="ml-2 text-red-500 font-bold">(Expired)</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {d.file_url ? (
                          <a href={d.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>
                        ) : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {canUpload && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-semibold mb-3">Upload Document</h3>
              <form onSubmit={handleUpload} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Document Type</label>
                  <input 
                    type="text" 
                    required 
                    value={docType} 
                    onChange={e => setDocType(e.target.value)}
                    className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border" 
                    placeholder="e.g. Insurance, RC"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Expiry Date (Optional)</label>
                  <input 
                    type="date" 
                    value={docExpiry} 
                    onChange={e => setDocExpiry(e.target.value)}
                    className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">File</label>
                  <input 
                    type="file" 
                    required 
                    onChange={e => setDocFile(e.target.files?.[0] || null)}
                    className="mt-1 block w-full text-sm text-gray-500" 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={uploadDocMutation.isPending || !docFile}
                  className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadDocMutation.isPending ? 'Uploading...' : 'Upload'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
