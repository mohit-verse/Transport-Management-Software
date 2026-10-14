import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Ban, Hash, AlertCircle, Filter } from 'lucide-react';
import {
  getNumberingSeriesList,
  createNumberingSeries,
  updateNumberingSeries,
  deactivateNumberingSeries,
  getParties,
  getFinancialYears,
  type NumberingSeriesRecord,
} from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Button } from './Button';

export const NumberingSeriesManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';

  // Filters state
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedFyId, setSelectedFyId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<NumberingSeriesRecord | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  // Form states
  const [formPartyId, setFormPartyId] = useState('');
  const [formFyId, setFormFyId] = useState('');
  const [formSeriesCode, setFormSeriesCode] = useState('');
  const [formPrefix, setFormPrefix] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: seriesData, isLoading, isError } = useQuery({
    queryKey: ['numbering-series', selectedPartyId, selectedFyId, activeFilter],
    queryFn: () =>
      getNumberingSeriesList({
        party_id: selectedPartyId || undefined,
        financial_year_id: selectedFyId || undefined,
        is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
      }),
  });

  const { data: partiesData } = useQuery({
    queryKey: ['parties'],
    queryFn: () => getParties(),
  });

  const { data: fyData } = useQuery({
    queryKey: ['financial-years'],
    queryFn: () => getFinancialYears(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createNumberingSeries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbering-series'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to create numbering series.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateNumberingSeries(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbering-series'] });
      setEditingSeries(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to update numbering series.');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateNumberingSeries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbering-series'] });
      setDeactivatingId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to deactivate series.');
      setDeactivatingId(null);
    },
  });

  const resetForm = () => {
    setFormPartyId('');
    setFormFyId('');
    setFormSeriesCode('');
    setFormPrefix('');
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (series: NumberingSeriesRecord) => {
    setFormError(null);
    setEditingSeries(series);
    setFormSeriesCode(series.series_code);
    setFormPrefix(series.prefix);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPartyId || !formFyId || !formSeriesCode.trim() || !formPrefix.trim()) {
      setFormError('Please fill out all required fields.');
      return;
    }
    createMutation.mutate({
      party_id: formPartyId,
      financial_year_id: formFyId,
      series_code: formSeriesCode.trim(),
      prefix: formPrefix.trim(),
    });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeries) return;
    updateMutation.mutate({
      id: editingSeries.id,
      data: {
        series_code: formSeriesCode.trim() || undefined,
        prefix: editingSeries.current_number === 0 ? formPrefix.trim() : undefined,
      },
    });
  };

  const seriesList = seriesData?.data || [];
  const parties = partiesData?.data || [];
  const financialYears = fyData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header with Title and Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <Hash className="w-5 h-5 text-blue-600 mr-2" />
            Numbering Series Configuration
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure financial year bill numbering prefixes per party. Counter reset and reuse of cancelled bill
            numbers are strictly prohibited by business rule.
          </p>
        </div>
        {isOwner && (
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            New Numbering Series
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2 text-xs font-medium text-gray-700">
          <Filter className="w-4 h-4 text-gray-400" />
          <span>Filters:</span>
        </div>

        {/* Party Filter */}
        <div className="w-52">
          <select
            value={selectedPartyId}
            onChange={(e) => setSelectedPartyId(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Parties</option>
            {parties.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* FY Filter */}
        <div className="w-44">
          <select
            value={selectedFyId}
            onChange={(e) => setSelectedFyId(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Financial Years</option>
            {financialYears.map((fy: any) => (
              <option key={fy.id} value={fy.id}>
                FY {fy.code}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-36">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Series List Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {isLoading && (
          <div className="py-12 text-center text-sm text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Loading numbering series...
          </div>
        )}

        {isError && (
          <div className="py-12 text-center text-sm text-red-600">
            Failed to load numbering series from server.
          </div>
        )}

        {!isLoading && !isError && seriesList.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-500">
            No numbering series found matching the selected filters.
          </div>
        )}

        {!isLoading && !isError && seriesList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-left">
                <tr>
                  <th className="px-4 py-3">Party Name</th>
                  <th className="px-4 py-3">Financial Year</th>
                  <th className="px-4 py-3">Series Code</th>
                  <th className="px-4 py-3">Prefix</th>
                  <th className="px-4 py-3 text-right">Current Number</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {isOwner && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {seriesList.map((series) => (
                  <tr key={series.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{series.party_name || '-'}</td>
                    <td className="px-4 py-3 font-mono font-medium">FY {series.financial_year_code || '-'}</td>
                    <td className="px-4 py-3 font-mono text-blue-700 font-medium">{series.series_code}</td>
                    <td className="px-4 py-3 font-mono bg-gray-50 font-semibold">{series.prefix}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                      {series.current_number}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          series.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {series.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(series)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Edit Series"
                        >
                          <Edit2 className="w-3.5 h-3.5 inline" />
                        </button>
                        {series.is_active && (
                          <button
                            onClick={() => setDeactivatingId(series.id)}
                            className="text-amber-600 hover:text-amber-800 p-1"
                            title="Deactivate Series"
                          >
                            <Ban className="w-3.5 h-3.5 inline" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">Create Numbering Series</h3>
            <form onSubmit={handleSubmitCreate} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-medium text-gray-700 mb-1">Party / Company *</label>
                <select
                  value={formPartyId}
                  onChange={(e) => setFormPartyId(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Party</option>
                  {parties.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Financial Year *</label>
                <select
                  value={formFyId}
                  onChange={(e) => setFormFyId(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Financial Year</option>
                  {financialYears.map((fy: any) => (
                    <option key={fy.id} value={fy.id}>
                      FY {fy.code} ({new Date(fy.start_date).toLocaleDateString()} - {new Date(fy.end_date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Series Code * (e.g. SRL-DEFAULT, CO-26)</label>
                <input
                  type="text"
                  value={formSeriesCode}
                  onChange={(e) => setFormSeriesCode(e.target.value)}
                  placeholder="e.g. SRL-26"
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Prefix * (e.g. SRL/26-27/)</label>
                <input
                  type="text"
                  value={formPrefix}
                  onChange={(e) => setFormPrefix(e.target.value)}
                  placeholder="e.g. SRL/26-27/"
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Prefix cannot be altered once bills have been issued under this series.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Save Series'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingSeries && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">Edit Numbering Series</h3>
            <form onSubmit={handleSubmitEdit} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-medium text-gray-500 mb-1">Party</label>
                <div className="p-2 bg-gray-50 rounded border border-gray-200 font-medium">
                  {editingSeries.party_name}
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-500 mb-1">Financial Year</label>
                <div className="p-2 bg-gray-50 rounded border border-gray-200 font-medium">
                  FY {editingSeries.financial_year_code}
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Series Code</label>
                <input
                  type="text"
                  value={formSeriesCode}
                  onChange={(e) => setFormSeriesCode(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Prefix</label>
                <input
                  type="text"
                  value={formPrefix}
                  onChange={(e) => setFormPrefix(e.target.value)}
                  disabled={editingSeries.current_number > 0}
                  className={`w-full border rounded p-2 font-mono ${
                    editingSeries.current_number > 0
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
                      : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
                  }`}
                />
                {editingSeries.current_number > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Locked: Prefix cannot be changed because {editingSeries.current_number} bill(s) have already been
                    issued under this series.
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingSeries(null)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Update Series'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivatingId && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-xs">
            <h3 className="text-base font-bold text-gray-900 mb-2">Deactivate Series</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to deactivate this numbering series? Deactivated series will not be selectable for
              new bills, but historical bills will retain their assigned numbers.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeactivatingId(null)}
                disabled={deactivateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => deactivateMutation.mutate(deactivatingId)}
                disabled={deactivateMutation.isPending}
              >
                {deactivateMutation.isPending ? 'Deactivating...' : 'Confirm Deactivation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
