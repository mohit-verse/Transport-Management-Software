import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileText,
  Upload,
  Search,
  Eye,
  Download,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  X,
  FileCheck,
  ShieldAlert,
  Info
} from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { Card, CardHeader, CardContent } from '../components/Card';
import { useAuthStore } from '../store/authStore';
import {
  getDocuments,
  uploadDocument,
  replaceDocument,
  deleteDocument,
  downloadDocumentFile,
  previewDocumentFile,
  type DocumentItem,
  type DocumentListParams,
  type UploadDocumentPayload
} from '../services/api';

const DOCUMENT_TYPES = [
  'POD',
  'RC',
  'FITNESS',
  'PERMIT',
  'INSURANCE',
  'POLLUTION',
  'PAYMENT_RECEIPT',
  'BILL_PDF',
  'COURIER_ENVELOPE',
  'OTHER'
];

const ENTITY_TYPES = [
  { value: 'TRIP', label: 'Trip' },
  { value: 'OWN_FLEET_VEHICLE', label: 'Own Fleet Vehicle' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'BILL', label: 'Bill' },
  { value: 'PARTY', label: 'Party / Company' },
  { value: 'VEHICLE_OWNER', label: 'Vehicle Owner' },
  { value: 'MARKET_VEHICLE', label: 'Market Vehicle' }
];

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const getEntityLink = (entityType?: string | null, entityId?: string | null): string => {
  if (!entityType || !entityId) return '#';
  switch (entityType.toUpperCase()) {
    case 'TRIP':
      return `/trips/${entityId}`;
    case 'OWN_FLEET_VEHICLE':
    case 'OWN_FLEET':
      return `/own-fleet/${entityId}`;
    case 'PAYMENT':
      return `/payments/${entityId}`;
    case 'BILL':
      return `/bills/${entityId}`;
    case 'PARTY':
      return `/parties/${entityId}`;
    case 'VEHICLE_OWNER':
      return `/vehicle-owners/${entityId}`;
    case 'MARKET_VEHICLE':
      return `/market-vehicles/${entityId}`;
    default:
      return '#';
  }
};

export const getDocTypeBadgeClass = (docType: string): string => {
  switch (docType.toUpperCase()) {
    case 'POD':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'RC':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'FITNESS':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'PERMIT':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'INSURANCE':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'POLLUTION':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'PAYMENT_RECEIPT':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'BILL_PDF':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function Documents() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isOwner = user?.role === 'OWNER';
  const isStaff = user?.role === 'STAFF';
  const isCA = user?.role === 'CA';
  const canUpload = isOwner || isStaff;
  const canReplace = isOwner;
  const canDelete = isOwner;

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('');
  const [selectedExpiryStatus, setSelectedExpiryStatus] = useState<'ALL' | 'EXPIRED' | 'EXPIRING_SOON' | 'ACTIVE'>('ALL');

  // Modal states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [replaceTargetDoc, setReplaceTargetDoc] = useState<DocumentItem | null>(null);
  const [deleteTargetDoc, setDeleteTargetDoc] = useState<DocumentItem | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch documents
  const queryParams: DocumentListParams = {
    search: searchTerm || undefined,
    document_type: selectedDocType || undefined,
    entity_type: selectedEntityType || undefined,
    expiry_status: selectedExpiryStatus === 'ALL' ? undefined : selectedExpiryStatus,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['documents', queryParams],
    queryFn: () => getDocuments(queryParams),
  });

  const documents = data?.data || [];

  // Own-Fleet Compliance Expiry Counts (scoped strictly to Own-Fleet compliance documents with an expiry_date)
  const ownFleetComplianceDocs = documents.filter(
    (d) => (d.entity_type === 'OWN_FLEET_VEHICLE' || d.entity_type === 'OWN_FLEET') && Boolean(d.expiry_date)
  );
  const expiredDocs = ownFleetComplianceDocs.filter((d) => d.expiry_status === 'EXPIRED');
  const expiringSoonDocs = ownFleetComplianceDocs.filter((d) => d.expiry_status === 'EXPIRING_SOON');
  const activeDocs = ownFleetComplianceDocs.filter((d) => d.expiry_status === 'ACTIVE');

  const handleExpiryCardClick = (status: 'EXPIRED' | 'EXPIRING_SOON' | 'ACTIVE') => {
    if (selectedExpiryStatus === status && selectedEntityType === 'OWN_FLEET_VEHICLE') {
      setSelectedExpiryStatus('ALL');
      setSelectedEntityType('');
    } else {
      setSelectedExpiryStatus(status);
      setSelectedEntityType('OWN_FLEET_VEHICLE');
    }
  };

  // Preview handling with cleanup
  useEffect(() => {
    let activeUrl: string | null = null;
    if (previewDoc) {
      setIsPreviewLoading(true);
      setPreviewError(null);
      previewDocumentFile(previewDoc.id)
        .then(({ blobUrl }) => {
          activeUrl = blobUrl;
          setPreviewUrl(blobUrl);
        })
        .catch((err) => {
          console.error('Preview error:', err);
          setPreviewError('Requested document file is unavailable in storage. Please contact the administrator or upload a replacement.');
        })
        .finally(() => {
          setIsPreviewLoading(false);
        });
    } else {
      setPreviewUrl(null);
      setPreviewError(null);
    }

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [previewDoc]);

  const handleDownload = async (doc: DocumentItem) => {
    try {
      await downloadDocumentFile(doc.id, doc.original_name);
    } catch (err) {
      console.error('Download error:', err);
      setActionFeedback({
        type: 'error',
        message: `Failed to download file "${doc.original_name}". File may be missing in storage.`,
      });
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedDocType('');
    setSelectedEntityType('');
    setSelectedExpiryStatus('ALL');
  };

  const isFiltered = Boolean(searchTerm || selectedDocType || selectedEntityType || selectedExpiryStatus !== 'ALL');

  return (
    <PageContainer
      title="Documents & Storage Management"
      actions={
        canUpload ? (
          <Button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* CA Read-Only Banner */}
        {isCA && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">CA Read-Only Document Access</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Your role provides read-only inspection and download access to operational, compliance, payment, and billing supporting records.
                Document uploading, file replacement, and deletion are restricted to operational staff and owners.
              </p>
            </div>
          </div>
        )}

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div
            className={`p-4 rounded-lg border flex items-center justify-between ${
              actionFeedback.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {actionFeedback.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              {actionFeedback.message}
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Own-Fleet Compliance Expiry Alerts (Hidden for CA role since CA cannot manage fleet operations) */}
        {!isCA && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => handleExpiryCardClick('EXPIRED')}
              className={`cursor-pointer p-4 rounded-lg border transition-all ${
                selectedExpiryStatus === 'EXPIRED' && selectedEntityType === 'OWN_FLEET_VEHICLE'
                  ? 'bg-red-50 border-red-400 ring-2 ring-red-400'
                  : 'bg-white border-gray-200 hover:border-red-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Expired Fleet Documents</span>
                <ShieldAlert className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-700 mt-2">{expiredDocs.length}</p>
              <p className="text-xs text-gray-500 mt-1">Requires immediate renewal / attention</p>
            </div>

            <div
              onClick={() => handleExpiryCardClick('EXPIRING_SOON')}
              className={`cursor-pointer p-4 rounded-lg border transition-all ${
                selectedExpiryStatus === 'EXPIRING_SOON' && selectedEntityType === 'OWN_FLEET_VEHICLE'
                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400'
                  : 'bg-white border-gray-200 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Expiring Soon (30 Days)</span>
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-amber-700 mt-2">{expiringSoonDocs.length}</p>
              <p className="text-xs text-gray-500 mt-1">Due for renewal within 30 days</p>
            </div>

            <div
              onClick={() => handleExpiryCardClick('ACTIVE')}
              className={`cursor-pointer p-4 rounded-lg border transition-all ${
                selectedExpiryStatus === 'ACTIVE' && selectedEntityType === 'OWN_FLEET_VEHICLE'
                  ? 'bg-green-50 border-green-400 ring-2 ring-green-400'
                  : 'bg-white border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Active / Valid Fleet Docs</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-700 mt-2">{activeDocs.length}</p>
              <p className="text-xs text-gray-500 mt-1">Compliant and up to date</p>
            </div>
          </div>
        )}

        {/* Filter and Search Toolbar */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search file, type, or entity..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Document Type Dropdown */}
              <div>
                <select
                  value={selectedDocType}
                  onChange={(e) => setSelectedDocType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Document Types</option>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Type Dropdown */}
              <div>
                <select
                  value={selectedEntityType}
                  onChange={(e) => setSelectedEntityType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Associated Entities</option>
                  {ENTITY_TYPES.map((entity) => (
                    <option key={entity.value} value={entity.value}>
                      {entity.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expiry Status Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedExpiryStatus}
                  onChange={(e) => setSelectedExpiryStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="ALL">All Expiry Statuses</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="EXPIRING_SOON">Expiring Soon</option>
                  <option value="ACTIVE">Active / Valid</option>
                </select>

                {isFiltered && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="text-gray-500 hover:text-gray-700 whitespace-nowrap"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document List Table */}
        <Card>
          <CardHeader className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500" />
              <span>Document Index ({documents.length})</span>
            </div>
            {isFiltered && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                Filtered view active
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading documents...</div>
            ) : isError ? (
              <div className="p-8 text-center text-red-600">
                Failed to load documents: {(error as any)?.message || 'Unknown error'}
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-700">No documents found</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isFiltered
                    ? 'Try clearing or relaxing your search/filter criteria.'
                    : 'Upload operational or compliance documents to build the index.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">File Name & Size</th>
                      <th className="px-4 py-3">Associated Record</th>
                      <th className="px-4 py-3">Expiry Date / Status</th>
                      <th className="px-4 py-3">Uploaded Info</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {documents.map((doc) => {
                      const entityUrl = getEntityLink(doc.entity_type, doc.entity_id);
                      return (
                        <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                          {/* Type */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getDocTypeBadgeClass(
                                doc.document_type
                              )}`}
                            >
                              {doc.document_type}
                            </span>
                          </td>

                          {/* Name & Size */}
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 truncate max-w-xs" title={doc.original_name}>
                              {doc.original_name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {formatBytes(doc.file_size_bytes)} • {doc.mime_type}
                            </div>
                          </td>

                          {/* Associated Record Link */}
                          <td className="px-4 py-3">
                            {doc.entity_type && doc.entity_id ? (
                              <div>
                                <Link
                                  to={entityUrl}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium inline-flex items-center gap-1 text-xs"
                                >
                                  <span>{doc.entity_reference || `${doc.entity_type}: ${doc.entity_id.slice(0, 8)}`}</span>
                                  <ExternalLink className="w-3 h-3 text-blue-500" />
                                </Link>
                                <div className="text-[11px] text-gray-400 uppercase mt-0.5">
                                  {doc.entity_type.replace(/_/g, ' ')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Unlinked</span>
                            )}
                          </td>

                          {/* Expiry Date / Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {doc.expiry_date ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-gray-800">
                                  {new Date(doc.expiry_date).toLocaleDateString()}
                                </div>
                                {doc.expiry_status === 'EXPIRED' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                                    <AlertTriangle className="w-3 h-3" />
                                    Expired
                                  </span>
                                )}
                                {doc.expiry_status === 'EXPIRING_SOON' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    <Clock className="w-3 h-3" />
                                    {doc.days_to_expiry !== null && doc.days_to_expiry !== undefined
                                      ? `${doc.days_to_expiry}d left`
                                      : 'Expiring soon'}
                                  </span>
                                )}
                                {doc.expiry_status === 'ACTIVE' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">
                                    <CheckCircle className="w-3 h-3" />
                                    Valid
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">No Expiry</span>
                            )}
                          </td>

                          {/* Upload Info */}
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                            <div>{doc.uploaded_by_name || 'Staff Member'}</div>
                            <div className="text-gray-400 text-[11px] mt-0.5">
                              {new Date(doc.uploaded_at).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Preview */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewDoc(doc)}
                                title="Preview Document"
                                className="p-1.5 text-gray-600 hover:text-blue-600"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              {/* Download */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(doc)}
                                title="Download File"
                                className="p-1.5 text-gray-600 hover:text-green-600"
                              >
                                <Download className="w-4 h-4" />
                              </Button>

                              {/* Replace (Owner Only) */}
                              {canReplace && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setReplaceTargetDoc(doc)}
                                  title="Replace Document (Owner Authority)"
                                  className="p-1.5 text-gray-600 hover:text-amber-600"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                              )}

                              {/* Delete (Owner Only) */}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteTargetDoc(doc)}
                                  title="Delete Document (Owner Authority)"
                                  className="p-1.5 text-gray-600 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <UploadModal
          onClose={() => setIsUploadOpen(false)}
          onSuccess={(msg) => {
            setIsUploadOpen(false);
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            setActionFeedback({ type: 'success', message: msg });
          }}
        />
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <PreviewModal
          doc={previewDoc}
          previewUrl={previewUrl}
          isLoading={isPreviewLoading}
          error={previewError}
          onClose={() => setPreviewDoc(null)}
          onDownload={() => handleDownload(previewDoc)}
        />
      )}

      {/* Replace Modal */}
      {replaceTargetDoc && (
        <ReplaceModal
          doc={replaceTargetDoc}
          onClose={() => setReplaceTargetDoc(null)}
          onSuccess={(msg) => {
            setReplaceTargetDoc(null);
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            setActionFeedback({ type: 'success', message: msg });
          }}
        />
      )}

      {/* Delete Modal */}
      {deleteTargetDoc && (
        <DeleteModal
          doc={deleteTargetDoc}
          onClose={() => setDeleteTargetDoc(null)}
          onSuccess={(msg) => {
            setDeleteTargetDoc(null);
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            setActionFeedback({ type: 'success', message: msg });
          }}
        />
      )}
    </PageContainer>
  );
}

// ==========================================
// Sub-Modals
// ==========================================

interface UploadModalProps {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const [entityType, setEntityType] = useState<UploadDocumentPayload['entity_type']>('TRIP');
  const [entityId, setEntityId] = useState('');
  const [documentType, setDocumentType] = useState('POD');
  const [customDocType, setCustomDocType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!entityId.trim()) {
      setUploadError('Associated Entity ID is required.');
      return;
    }

    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one file to upload.');
      return;
    }

    const finalDocType = documentType === 'OTHER' && customDocType.trim() ? customDocType.trim().toUpperCase() : documentType;

    setIsSubmitting(true);
    try {
      for (const file of selectedFiles) {
        await uploadDocument({
          entity_type: entityType,
          entity_id: entityId.trim(),
          document_type: finalDocType,
          original_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          file_size_bytes: file.size,
          expiry_date: expiryDate ? expiryDate : null,
        });
      }
      onSuccess(`Successfully uploaded ${selectedFiles.length} document(s).`);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.message || err.message || 'Failed to upload document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Upload Document</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Associated Entity Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Associated Entity Type *
            </label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {ENTITY_TYPES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          {/* Entity ID / UUID */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Associated Entity ID (UUID) *
            </label>
            <input
              type="text"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
              required
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Must match an existing record of the chosen entity type.
            </p>
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Document Type *
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {documentType === 'OTHER' && (
              <input
                type="text"
                placeholder="Enter custom document type..."
                value={customDocType}
                onChange={(e) => setCustomDocType(e.target.value)}
                className="w-full mt-2 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                required
              />
            )}
          </div>

          {/* Expiry Date (Optional / Recommended for Compliance) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Document Expiry Date (Optional)
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Recommended for Own-Fleet compliance documents (RC, Fitness, Insurance, Pollution, Permit).
            </p>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Select File(s) *
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-700">
                  {selectedFiles.length} file(s) selected:
                </p>
                <div className="max-h-24 overflow-y-auto space-y-1 bg-gray-50 p-2 rounded border border-gray-200">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-gray-600">
                      <span className="truncate max-w-[280px]">{file.name}</span>
                      <span>{formatBytes(file.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : `Upload (${selectedFiles.length || 0})`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PreviewModalProps {
  doc: DocumentItem;
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onDownload: () => void;
}

function PreviewModal({ doc, previewUrl, isLoading, error, onClose, onDownload }: PreviewModalProps) {
  const isImage = doc.mime_type.startsWith('image/');
  const isPdf = doc.mime_type === 'application/pdf' || doc.original_name.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-base font-bold text-gray-900 truncate max-w-md" title={doc.original_name}>
              {doc.original_name}
            </h3>
            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
              <span className="font-semibold text-gray-700">{doc.document_type}</span>
              <span>•</span>
              <span>{formatBytes(doc.file_size_bytes)}</span>
              {doc.entity_reference && (
                <>
                  <span>•</span>
                  <span>{doc.entity_reference}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onDownload} className="flex items-center gap-1.5">
              <Download className="w-4 h-4" />
              Download
            </Button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-gray-100 min-h-[400px]">
          {isLoading ? (
            <div className="text-center text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-sm">Retrieving secure file stream...</p>
            </div>
          ) : error ? (
            <div className="max-w-md p-6 bg-white rounded-lg border border-red-200 shadow-sm text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <h4 className="font-bold text-gray-900">Document Unavailable</h4>
              <p className="text-xs text-gray-600 mt-2">{error}</p>
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : previewUrl ? (
            isImage ? (
              <img
                src={previewUrl}
                alt={doc.original_name}
                className="max-h-[650px] max-w-full rounded object-contain shadow-sm"
              />
            ) : isPdf ? (
              <iframe
                src={previewUrl}
                title={`Preview Frame - ${doc.original_name}`}
                className="w-full h-[650px] rounded border border-gray-300 bg-white"
              />
            ) : (
              <div className="p-8 text-center bg-white rounded-lg border border-gray-200">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-800">Preview not supported for this file type</p>
                <p className="text-xs text-gray-500 mt-1">
                  MIME: {doc.mime_type}. Use Download to view the file with your local application.
                </p>
                <div className="mt-4">
                  <Button onClick={onDownload} className="flex items-center gap-2 mx-auto">
                    <Download className="w-4 h-4" />
                    Download File
                  </Button>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface ReplaceModalProps {
  doc: DocumentItem;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ReplaceModal({ doc, onClose, onSuccess }: ReplaceModalProps) {
  const [newFile, setNewFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState(doc.expiry_date || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newFile) {
      setError('Please select a replacement file.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError('A valid replacement reason (at least 5 characters) is required for audit history.');
      return;
    }

    setIsSubmitting(true);
    try {
      await replaceDocument(doc.id, {
        original_name: newFile.name,
        mime_type: newFile.type || 'application/octet-stream',
        file_size_bytes: newFile.size,
        expiry_date: expiryDate ? expiryDate : null,
        reason: reason.trim(),
      });
      onSuccess(`Document "${doc.original_name}" replaced with "${newFile.name}".`);
    } catch (err: any) {
      console.error('Replace failed:', err);
      setError(err.response?.data?.message || err.message || 'Failed to replace document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-amber-50">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-gray-900">Replace Document (Owner Authority)</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-md">
            Replacing this document will archive the existing version and upload the new file linked to the same business entity. The audit log will record your replacement reason.
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Target Document:</span>
            <p className="text-sm font-semibold text-gray-800">{doc.original_name}</p>
            <p className="text-xs text-gray-500">
              Type: {doc.document_type} • Linked: {doc.entity_reference || doc.entity_id}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              New File *
            </label>
            <input
              type="file"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setNewFile(e.target.files[0]);
                }
              }}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              New Expiry Date (Optional)
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Replacement Reason (Mandatory Audit Requirement) *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Renewed fitness certificate uploaded from RTO."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Replacing...' : 'Confirm Replacement'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  doc: DocumentItem;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function DeleteModal({ doc, onClose, onSuccess }: DeleteModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim() || reason.trim().length < 5) {
      setError('A valid deletion reason (at least 5 characters) is required for audit history.');
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteDocument(doc.id, reason.trim());
      onSuccess(`Document "${doc.original_name}" has been deleted.`);
    } catch (err: any) {
      console.error('Delete failed:', err);
      setError(err.response?.data?.message || err.message || 'Failed to delete document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-red-50">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-gray-900">Delete Document</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md">
            Soft deleting this document will remove it from active listings and storage links. The record and deletion reason will be permanently preserved in the audit log.
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Document to Delete:</span>
            <p className="text-sm font-semibold text-gray-900">{doc.original_name}</p>
            <p className="text-xs text-gray-500">
              Type: {doc.document_type} • Linked: {doc.entity_reference || doc.entity_id}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Deletion Reason (Mandatory Audit Requirement) *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Document was uploaded in error for wrong trip."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Confirm Deletion'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
