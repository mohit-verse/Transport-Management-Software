import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Hash,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { useAuthStore } from '../store/authStore';
import {
  getBillTemplates,
  getBillTemplate,
  deleteBillTemplate,
  type BillTemplateListItem,
  type BillTemplateDetail,
  type TemplateImportResult,
} from '../services/api';
import { TemplateImportModal } from '../components/TemplateImportModal';
import { TemplatePreviewModal } from '../components/TemplatePreviewModal';
import { NumberingSeriesManager } from '../components/NumberingSeriesManager';

export default function BillingSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';
  const isStaff = user?.role === 'STAFF';

  // Tab state: 'templates' | 'numbering'
  const [activeTab, setActiveTab] = useState<'templates' | 'numbering'>('templates');

  // Filters state for Templates
  const [search, setSearch] = useState('');
  const [templateType, setTemplateType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [previewTemplateDetail, setPreviewTemplateDetail] = useState<BillTemplateDetail | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Delete modal state
  const [templateToDelete, setTemplateToDelete] = useState<BillTemplateListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Query templates
  const {
    data: templatesData,
    isLoading: isTemplatesLoading,
    isError: isTemplatesError,
    error: templatesQueryError,
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ['bill-templates', search, templateType, status, page],
    queryFn: () =>
      getBillTemplates({
        search: search.trim() || undefined,
        template_type: templateType || undefined,
        status: status || undefined,
        page,
        limit,
      }),
    enabled: activeTab === 'templates',
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBillTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill-templates'] });
      setTemplateToDelete(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete template. Please check dependencies.';
      setDeleteError(message);
    },
  });

  const handleResetFilters = () => {
    setSearch('');
    setTemplateType('');
    setStatus('');
    setPage(1);
  };

  const handleOpenPreview = async (templateId: string) => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await getBillTemplate(templateId);
      if (res.data) {
        setPreviewTemplateDetail(res.data);
      }
    } catch (err: any) {
      setPreviewError(err?.response?.data?.message || 'Failed to load template details for preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleImportSuccess = (imported: TemplateImportResult) => {
    setIsImportModalOpen(false);
    // Navigate to create template page with pre-populated imported draft
    navigate('/settings/billing/templates/new', {
      state: { importedTemplate: imported },
    });
  };

  const handleDeleteConfirm = () => {
    if (!templateToDelete) return;
    deleteMutation.mutate(templateToDelete.id);
  };

  const templatesList = templatesData?.data || [];

  return (
    <PageContainer title="Billing Settings & Designer">
      {/* Subtitle description */}
      <p className="text-sm text-gray-500 -mt-4 mb-6">
        Manage bill layout templates, document designs, and party-specific invoice numbering series.
      </p>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Bill Templates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('numbering')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'numbering'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Hash className="w-4 h-4" />
            Numbering Series
          </button>
        </nav>
      </div>

      {/* Role Banner for Staff / CA */}
      {!isOwner && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-blue-600" />
          <span>
            {isStaff
              ? 'Operational Mode: You have read-only access to billing templates and numbering series. You may preview active templates for operational awareness.'
              : 'Audit Mode (CA): You have read-only inspection access to billing configuration.'}
          </span>
        </div>
      )}

      {/* TEMPLATES TAB CONTENT */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Top action row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Configured Bill Templates</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Structured document layouts for generating individual and consolidated company bills.
              </p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Import Reference
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate('/settings/billing/templates/new')}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Create Template
                </Button>
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search template name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full text-sm rounded-md border border-gray-300 py-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Template Type */}
              <div>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full text-sm rounded-md border border-gray-300 py-2 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Template Types</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="CONSOLIDATED">Consolidated</option>
                  <option value="MULTI_PAGE">Multi-Page</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full text-sm rounded-md border border-gray-300 py-2 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              {/* Reset */}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResetFilters}
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Filters
                </Button>
              </div>
            </div>
          </div>

          {/* Error notice if loading failed */}
          {isTemplatesError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span>
                  {(templatesQueryError as any)?.response?.data?.message ||
                    'Failed to load bill templates. Please try again.'}
                </span>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => refetchTemplates()}>
                Retry
              </Button>
            </div>
          )}

          {/* Templates Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {isTemplatesLoading ? (
              <div className="p-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
                Loading templates...
              </div>
            ) : templatesList.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900">No bill templates found</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  {search || templateType || status
                    ? 'No templates match the current filter criteria. Try clearing filters.'
                    : 'Get started by creating a new template or importing an existing reference document.'}
                </p>
                {isOwner && (
                  <div className="mt-4 flex justify-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsImportModalOpen(true)}
                    >
                      Import Reference
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => navigate('/settings/billing/templates/new')}
                    >
                      Create Template
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left">
                        Template Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left">
                        Components
                      </th>
                      <th scope="col" className="px-6 py-3 text-left">
                        Dynamic Fields
                      </th>
                      <th scope="col" className="px-6 py-3 text-left">
                        Last Updated
                      </th>
                      <th scope="col" className="px-6 py-3 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {templatesList.map((tpl) => (
                      <tr key={tpl.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <span>{tpl.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              tpl.template_type === 'CONSOLIDATED'
                                ? 'bg-purple-100 text-purple-800'
                                : tpl.template_type === 'MULTI_PAGE'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {tpl.template_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={tpl.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-gray-400" />
                            {tpl.component_count || 0} elements
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {tpl.dynamic_field_count || 0} fields
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                          {tpl.updated_at ? new Date(tpl.updated_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Preview button for all allowed roles */}
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(tpl.id)}
                              disabled={isPreviewLoading}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Preview Template"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Owner mutations */}
                            {isOwner && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(`/settings/billing/templates/${tpl.id}/edit`)
                                  }
                                  className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                  title="Edit in Designer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTemplateToDelete(tpl);
                                    setDeleteError(null);
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Delete Template"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NUMBERING SERIES TAB CONTENT */}
      {activeTab === 'numbering' && (
        <div className="space-y-6">
          <NumberingSeriesManager />
        </div>
      )}

      {/* REFERENCE IMPORT MODAL */}
      <TemplateImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* TEMPLATE PREVIEW MODAL */}
      {previewTemplateDetail && (
        <TemplatePreviewModal
          isOpen={!!previewTemplateDetail}
          onClose={() => setPreviewTemplateDetail(null)}
          templateId={previewTemplateDetail.id}
          templateType={previewTemplateDetail.template_type}
          layoutJson={previewTemplateDetail.layout_json}
          components={previewTemplateDetail.components}
          dynamicFields={previewTemplateDetail.dynamic_fields}
        />
      )}

      {/* PREVIEW ERROR ALERT */}
      {previewError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{previewError}</span>
          <button
            type="button"
            onClick={() => setPreviewError(null)}
            className="text-white hover:text-gray-200 font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL WITH HISTORICAL PROTECTION WARNING */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete Bill Template</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Are you sure you want to delete template{' '}
                  <strong className="text-gray-700">"{templateToDelete.name}"</strong>?
                </p>
              </div>
            </div>

            {/* Crucial historical lock warning */}
            {deleteError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Deletion Rejected by Server
                </div>
                <p>{deleteError}</p>
                {deleteError.toLowerCase().includes('historical') && (
                  <p className="text-gray-700 italic border-t border-red-200 pt-1.5 mt-1.5">
                    To prevent visual regressions of issued bills, historical templates cannot be
                    deleted. Consider setting the template status to <strong>ARCHIVED</strong> in
                    the editor instead.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs">
                <strong>Document Integrity Rule:</strong> If this template was ever used to generate
                issued or historical bills, the server will reject deletion to preserve document
                reproducibility.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTemplateToDelete(null);
                  setDeleteError(null);
                }}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
