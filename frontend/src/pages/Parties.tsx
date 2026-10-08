import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getParties, type Party } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function Parties() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['parties'],
    queryFn: getParties
  });

  if (isLoading) return <div className="p-4">Loading parties...</div>;
  if (error) return <div className="p-4 text-red-500">Error loading parties</div>;

  const parties = data?.data || [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Parties / Companies</h1>
        {user?.role !== 'CA' && (
          <button
            onClick={() => navigate('/parties/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Add Party
          </button>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Mobile</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {parties.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No parties found</td>
              </tr>
            ) : (
              parties.map((party: Party) => (
                <tr key={party.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{party.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{party.primary_mobile}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{party.party_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-red-600 font-medium">
                    {party.outstanding != null ? `₹${party.outstanding}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-green-600 font-medium">
                    {party.credit != null ? `₹${party.credit}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => navigate(`/parties/${party.id}`)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      View
                    </button>
                    {user?.role !== 'CA' && (
                      <button
                        onClick={() => navigate(`/parties/${party.id}/edit`)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
