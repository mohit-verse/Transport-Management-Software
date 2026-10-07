import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { Card, CardHeader, CardContent } from '../components/Card';

const TripDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const response = await api.get(`/api/trips/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });

  const uploadPodMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('trip_id', id!);
      
      const res = await api.post('/api/documents/pod', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
    },
  });

  const handleDownload = async (docId: string, filename: string) => {
    try {
      const response = await api.get(`/api/documents/${docId}/file`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Download failed', err);
      alert('Failed to download document');
    }
  };

  const handlePodUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadPodMutation.mutate(e.target.files[0]);
    }
  };

  if (isLoading) return <PageContainer title="Loading..."><p>Loading trip details...</p></PageContainer>;
  if (error || !data) return <PageContainer title="Error"><p>Failed to load trip details. {error instanceof Error ? error.message : ''}</p></PageContainer>;

  const {
    trip_id,
    trip_date,
    trip_status,
    origin,
    destination,
    driver_mobile_number,
    lr_number,
    invoice_number,
    loading_date,
    unloading_date,
    party,
    market_vehicle,
    vehicle_owner,
    own_fleet_vehicle,
    destinations,
    financials,
    pod,
    issues,
    bills,
    payments,
    documents
  } = data;

  return (
    <PageContainer 
      title={`Trip ${trip_id || id}`}
      actions={
        <Button onClick={() => navigate(`/trips/${id}/edit`)}>Edit Trip</Button>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        {/* Trip Overview */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>Trip Overview</CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-gray-500">Status</span>
                <p className="font-medium">{trip_status || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Date</span>
                <p className="font-medium">{trip_date ? new Date(trip_date).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Origin</span>
                <p className="font-medium">{origin || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Destination</span>
                <p className="font-medium">{destination || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">LR Number</span>
                <p className="font-medium">{lr_number || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Invoice Number</span>
                <p className="font-medium">{invoice_number || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Loading Date</span>
                <p className="font-medium">{loading_date ? new Date(loading_date).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Unloading Date</span>
                <p className="font-medium">{unloading_date ? new Date(unloading_date).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Party */}
        <Card>
          <CardHeader>Party</CardHeader>
          <CardContent>
            {party ? (
              <div>
                <p className="font-medium">{party.name}</p>
              </div>
            ) : (
              <p className="text-gray-500">No party linked.</p>
            )}
          </CardContent>
        </Card>

        {/* Vehicle / Company */}
        <Card>
          <CardHeader>Vehicle & Owner</CardHeader>
          <CardContent>
            {market_vehicle && (
              <div className="mb-2">
                <span className="text-sm text-gray-500">Market Vehicle</span>
                <p className="font-medium">{market_vehicle.vehicle_number}</p>
              </div>
            )}
            {vehicle_owner && (
              <div className="mb-2">
                <span className="text-sm text-gray-500">Vehicle Owner</span>
                <p className="font-medium">{vehicle_owner.owner_name}</p>
              </div>
            )}
            {own_fleet_vehicle && (
              <div className="mb-2">
                <span className="text-sm text-gray-500">Own Fleet</span>
                <p className="font-medium">{own_fleet_vehicle.vehicle_number}</p>
              </div>
            )}
            {driver_mobile_number && (
              <div>
                <span className="text-sm text-gray-500">Driver Mobile</span>
                <p className="font-medium">{driver_mobile_number}</p>
              </div>
            )}
            {!market_vehicle && !vehicle_owner && !own_fleet_vehicle && (
              <p className="text-gray-500">No vehicle details linked.</p>
            )}
          </CardContent>
        </Card>

        {/* POD */}
        <Card>
          <CardHeader>POD Information</CardHeader>
          <CardContent>
            {pod ? (
              <div className="space-y-2">
                <p><span className="text-sm text-gray-500">Status:</span> {pod.status}</p>
                <p><span className="text-sm text-gray-500">Received:</span> {pod.received_date ? new Date(pod.received_date).toLocaleDateString() : 'N/A'}</p>
                {pod.remark && <p><span className="text-sm text-gray-500">Remark:</span> {pod.remark}</p>}
              </div>
            ) : (
              <p className="text-gray-500 mb-2">No POD uploaded yet.</p>
            )}
            <div className="mt-4">
              <label className="block mb-2 text-sm font-medium text-gray-900">Upload POD</label>
              <input type="file" accept="image/*,.pdf" onChange={handlePodUpload} disabled={uploadPodMutation.isPending} className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50" />
              {uploadPodMutation.isPending && <p className="text-sm text-blue-500 mt-1">Uploading...</p>}
            </div>
          </CardContent>
        </Card>

        {/* Destinations */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>Destinations</CardHeader>
          <CardContent>
            {destinations && destinations.length > 0 ? (
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-2">Seq</th>
                    <th className="px-4 py-2">From</th>
                    <th className="px-4 py-2">To</th>
                    <th className="px-4 py-2">Distance (km)</th>
                  </tr>
                </thead>
                <tbody>
                  {destinations.map((d: any) => (
                    <tr key={d.id} className="border-b">
                      <td className="px-4 py-2">{d.sequence_no}</td>
                      <td className="px-4 py-2">{d.from_location}</td>
                      <td className="px-4 py-2">{d.to_location}</td>
                      <td className="px-4 py-2">{d.distance_km || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500">No destinations defined.</p>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>Financial Summary</CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-2">Party Financials</h3>
                {financials?.party ? (
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt>Freight Amount</dt><dd>{financials.party.freight_amount || 0}</dd></div>
                    <div className="flex justify-between"><dt>Detention Amount</dt><dd>{financials.party.detention_amount || 0}</dd></div>
                    <div className="flex justify-between"><dt>TDS Amount</dt><dd>{financials.party.tds_amount || 0}</dd></div>
                    <div className="flex justify-between"><dt>Commission Amount</dt><dd>{financials.party.commission_amount || 0}</dd></div>
                    <div className="flex justify-between"><dt>Total Amount</dt><dd className="font-bold">{financials.party.total_amount || 0}</dd></div>
                    <div className="flex justify-between text-blue-600"><dt>Advance Amount</dt><dd>{financials.party.advance_amount || 0}</dd></div>
                    <div className="flex justify-between text-green-600"><dt>Paid Amount</dt><dd>{financials.party.paid_amount || 0}</dd></div>
                    <div className="flex justify-between text-red-600"><dt>Balance Amount</dt><dd className="font-bold">{financials.party.balance_amount || 0}</dd></div>
                  </dl>
                ) : (
                  <p className="text-gray-500">No party financials.</p>
                )}
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Vehicle Owner Financials</h3>
                {financials?.vehicle_owner ? (
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt>Total Freight</dt><dd>{financials.vehicle_owner.total_freight || 0}</dd></div>
                    <div className="flex justify-between"><dt>Advance Amount</dt><dd>{financials.vehicle_owner.advance_amount || 0}</dd></div>
                    <div className="flex justify-between"><dt>Total Deductions</dt><dd>{financials.vehicle_owner.total_deductions || 0}</dd></div>
                    <div className="flex justify-between"><dt>Total Amount</dt><dd className="font-bold">{financials.vehicle_owner.total_amount || 0}</dd></div>
                    <div className="flex justify-between text-green-600"><dt>Paid Amount</dt><dd>{financials.vehicle_owner.paid_amount || 0}</dd></div>
                    <div className="flex justify-between text-red-600"><dt>Balance Amount</dt><dd className="font-bold">{financials.vehicle_owner.balance_amount || 0}</dd></div>
                  </dl>
                ) : (
                  <p className="text-gray-500">No owner financials.</p>
                )}
              </div>
            </div>
            
            {(financials?.other_charges?.length > 0 || financials?.deductions?.length > 0) && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                {financials?.other_charges?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-500 mb-1">Other Charges</h4>
                    <ul className="text-sm list-disc pl-5">
                      {financials.other_charges.map((c: any) => <li key={c.id}>{c.charge_name}: {c.amount}</li>)}
                    </ul>
                  </div>
                )}
                {financials?.deductions?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-500 mb-1">Deductions</h4>
                    <ul className="text-sm list-disc pl-5">
                      {financials.deductions.map((d: any) => <li key={d.id}>{d.reason}: {d.amount}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments Information */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>Payments</CardHeader>
          <CardContent>
            {payments && payments.length > 0 ? (
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-2">Ref No</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Allocation Type</th>
                    <th className="px-4 py-2">Allocation Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-b">
                      <td className="px-4 py-2">{p.reference_number || p.id.substring(0,8)}</td>
                      <td className="px-4 py-2">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'N/A'}</td>
                      <td className="px-4 py-2">{p.allocation_type}</td>
                      <td className="px-4 py-2">{p.allocation_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500">No payments found for this trip.</p>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>Documents</CardHeader>
          <CardContent>
            {documents && documents.length > 0 ? (
              <ul className="space-y-2">
                {documents.map((doc: any) => (
                  <li key={doc.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{doc.file_name || 'Document'}</p>
                      <p className="text-xs text-gray-500">Type: {doc.document_type || doc.link_type}</p>
                    </div>
                    <Button variant="secondary" onClick={() => handleDownload(doc.id, doc.file_name)}>Download</Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No documents attached.</p>
            )}
          </CardContent>
        </Card>

        {/* Issues */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>Issues</CardHeader>
          <CardContent>
            {issues && issues.length > 0 ? (
              <ul className="space-y-4">
                {issues.map((i: any) => (
                  <li key={i.id} className="border-l-4 border-red-500 pl-4">
                    <p className="font-medium">{i.issue_type}</p>
                    <p className="text-sm text-gray-700">{i.description}</p>
                    <p className="text-xs text-gray-500 mt-1">Status: {i.status}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No issues reported.</p>
            )}
          </CardContent>
        </Card>

        {/* Bills */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>Bills</CardHeader>
          <CardContent>
            {bills && bills.length > 0 ? (
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-2">Bill No</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Total Amount</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b: any) => (
                    <tr key={b.id} className="border-b">
                      <td className="px-4 py-2">{b.bill_number}</td>
                      <td className="px-4 py-2">{b.bill_date ? new Date(b.bill_date).toLocaleDateString() : 'N/A'}</td>
                      <td className="px-4 py-2">{b.total_amount}</td>
                      <td className="px-4 py-2">{b.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500">No bills generated yet.</p>
            )}
          </CardContent>
        </Card>

      </div>
    </PageContainer>
  );
};

export default TripDetails;
