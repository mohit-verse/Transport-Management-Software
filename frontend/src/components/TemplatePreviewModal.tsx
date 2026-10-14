import React, { useState, useEffect } from 'react';
import { Eye, X, RefreshCw, FileText, Code, AlertCircle, ShieldCheck } from 'lucide-react';
import {
  previewBillTemplatePdf,
  previewBillTemplateJson,
  type BillTemplateComponent,
  type DynamicFieldBinding
} from '../services/api';
import { Button } from './Button';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string;
  templateType: 'INDIVIDUAL' | 'CONSOLIDATED' | 'MULTI_PAGE';
  layoutJson: Record<string, any>;
  components: BillTemplateComponent[];
  dynamicFields: DynamicFieldBinding[];
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  isOpen,
  onClose,
  templateId,
  templateType,
  layoutJson,
  components,
  dynamicFields,
}) => {
  const [viewMode, setViewMode] = useState<'PDF' | 'JSON'>('PDF');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<any>(null);

  const fetchPreview = async () => {
    setIsLoading(true);
    setError(null);

    const payload = {
      template_id: templateId,
      template_type: templateType,
      layout_json: layoutJson,
      components,
      dynamic_fields: dynamicFields,
    };

    try {
      if (viewMode === 'PDF') {
        const blob = await previewBillTemplatePdf(payload);
        if (pdfUrl && typeof window !== 'undefined' && window.URL?.revokeObjectURL) {
          window.URL.revokeObjectURL(pdfUrl);
        }
        const url =
          typeof window !== 'undefined' && window.URL?.createObjectURL
            ? window.URL.createObjectURL(blob)
            : 'blob:preview';
        setPdfUrl(url);
      } else {
        const res = await previewBillTemplateJson(payload);
        setJsonData(res.data);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to generate template preview.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    }
    return () => {
      if (pdfUrl && typeof window !== 'undefined' && window.URL?.revokeObjectURL) {
        window.URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen, viewMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Eye className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Document Template Preview</h2>
            <div className="flex bg-gray-200 rounded-md p-0.5 text-xs">
              <button
                onClick={() => setViewMode('PDF')}
                className={`px-3 py-1 font-medium rounded ${
                  viewMode === 'PDF' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 inline mr-1" />
                PDF Document
              </button>
              <button
                onClick={() => setViewMode('JSON')}
                className={`px-3 py-1 font-medium rounded ${
                  viewMode === 'JSON' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Code className="w-3.5 h-3.5 inline mr-1" />
                Data & Tokens
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchPreview}
              disabled={isLoading}
              title="Refresh Preview"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security & Non-Mutation Assurance Banner */}
        <div className="bg-emerald-50 px-6 py-2 border-b border-emerald-100 text-xs text-emerald-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Safe Non-Mutating Execution:</strong> No bill numbers consumed • No bills created • No database writes.
            </span>
          </div>
          <span className="text-[11px] text-emerald-700">Type: {templateType}</span>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-gray-100 relative overflow-hidden flex flex-col">
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 z-10 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm font-medium text-gray-700">Rendering preview from template snapshot...</p>
            </div>
          )}

          {error && (
            <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Preview Generation Error:</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && viewMode === 'PDF' && pdfUrl && (
            <iframe
              src={pdfUrl}
              title="Bill Template PDF Preview"
              className="w-full h-full border-0"
            />
          )}

          {!isLoading && !error && viewMode === 'JSON' && jsonData && (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Resolved Dynamic Field Values</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {Object.entries(jsonData.resolved_dynamic_fields || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between p-1.5 bg-gray-50 rounded border border-gray-100">
                      <span className="font-mono text-gray-600">{key}:</span>
                      <span className="font-semibold text-gray-900 truncate max-w-[250px]">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Raw Layout & Component Hierarchy</h3>
                <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto max-h-80">
                  {JSON.stringify({ layout: jsonData.layout_json, components: jsonData.components }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs text-gray-500 flex-shrink-0">
          <span>{components.length} component(s) in active template draft</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </div>
    </div>
  );
};
