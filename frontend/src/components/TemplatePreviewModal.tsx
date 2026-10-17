import React, { useState, useEffect } from 'react';
import {
  Eye,
  X,
  RefreshCw,
  FileText,
  Code,
  AlertCircle,
  ShieldCheck,
  Download,
  ExternalLink,
  Layout
} from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'PDF' | 'DOCUMENT' | 'JSON'>('PDF');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<any>(null);

  const isLandscape = layoutJson?.orientation === 'LANDSCAPE';
  const rawW = Number(layoutJson?.page_width) || 595;
  const rawH = Number(layoutJson?.page_height) || 842;
  const pageWidth = isLandscape ? Math.max(rawW, rawH) : Math.min(rawW, rawH);
  const pageHeight = isLandscape ? Math.min(rawW, rawH) : Math.max(rawW, rawH);
  const marginTop = Number(layoutJson?.margin_top) || 36;
  const marginBottom = Number(layoutJson?.margin_bottom) || 36;
  const marginLeft = Number(layoutJson?.margin_left) || 36;
  const marginRight = Number(layoutJson?.margin_right) || 36;

  const fetchPreview = async () => {
    setIsLoading(true);
    setError(null);

    const cleanDynamicFields = (dynamicFields || []).map((df) => ({
      ...df,
      field_definition_id: df.field_definition_id || undefined,
    }));

    const payload = {
      template_id: templateId && templateId.trim() !== '' ? templateId : undefined,
      template_type: templateType,
      layout_json: layoutJson,
      components,
      dynamic_fields: cleanDynamicFields,
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
      let msg = err.message || 'Failed to generate template preview.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.message || parsed.error || text;
        } catch (_) {
          // ignore JSON parse fallback
        }
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      }
      setError(msg);
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Eye className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Document Template Preview</h2>
            <div className="flex bg-gray-200 rounded-md p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('PDF')}
                className={`px-3 py-1 font-medium rounded flex items-center gap-1.5 transition-colors ${
                  viewMode === 'PDF' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF Document
              </button>
              <button
                type="button"
                onClick={() => setViewMode('DOCUMENT')}
                className={`px-3 py-1 font-medium rounded flex items-center gap-1.5 transition-colors ${
                  viewMode === 'DOCUMENT' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                Visual Document
              </button>
              <button
                type="button"
                onClick={() => setViewMode('JSON')}
                className={`px-3 py-1 font-medium rounded flex items-center gap-1.5 transition-colors ${
                  viewMode === 'JSON' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Data & Tokens
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {viewMode === 'PDF' && pdfUrl && (
              <>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700 flex items-center gap-1"
                  title="Open in New Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </a>
                <a
                  href={pdfUrl}
                  download={`preview_${templateType.toLowerCase()}.pdf`}
                  className="px-2.5 py-1 text-xs bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 text-blue-700 flex items-center gap-1 font-medium"
                  title="Download PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </>
            )}
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
          <div className="flex items-center gap-3 text-[11px] text-emerald-700">
            <span>Orientation: <strong>{isLandscape ? 'Landscape' : 'Portrait'}</strong></span>
            <span>Size: <strong>{Math.round(pageWidth)} × {Math.round(pageHeight)} pt</strong></span>
            <span>Type: <strong>{templateType}</strong></span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-gray-200 relative overflow-hidden flex flex-col">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm font-medium text-gray-700">Rendering preview from template snapshot...</p>
            </div>
          )}

          {error && (
            <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-start space-x-2 z-10">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Preview Generation Notice:</p>
                <p className="mt-1">{error}</p>
                <p className="mt-2 text-xs text-red-600">
                  Tip: Switch to the <strong>Visual Document</strong> tab to view the live layout draft.
                </p>
              </div>
            </div>
          )}

          {/* VIEW: PDF IFRAME */}
          {!isLoading && !error && viewMode === 'PDF' && pdfUrl && (
            <div className="flex-1 w-full h-full relative">
              <iframe
                src={pdfUrl}
                title="Bill Template PDF Preview"
                className="w-full h-full border-0"
              />
            </div>
          )}

          {/* VIEW: VISUAL DOCUMENT PREVIEW */}
          {!isLoading && viewMode === 'DOCUMENT' && (
            <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
              <div
                className="bg-white shadow-2xl relative select-none"
                style={{
                  width: `${pageWidth}px`,
                  minHeight: `${pageHeight}px`,
                }}
              >
                {/* Print Margins boundary */}
                <div
                  className="absolute pointer-events-none border border-dashed border-blue-200"
                  style={{
                    top: `${marginTop}px`,
                    bottom: `${marginBottom}px`,
                    left: `${marginLeft}px`,
                    right: `${marginRight}px`,
                  }}
                >
                  <span className="absolute -top-3.5 left-0 text-[8px] text-blue-300 font-mono">
                    Print Margin ({marginLeft}pt)
                  </span>
                </div>

                {/* Render All Components with Sample Data */}
                {components.map((comp) => {
                  const x = comp.position_x ?? marginLeft;
                  const y = comp.position_y ?? marginTop;
                  const w = comp.width ?? (pageWidth - marginLeft - marginRight);
                  const h = comp.height ?? 30;

                  return (
                    <div
                      key={comp.component_key}
                      className="absolute overflow-hidden"
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                      }}
                    >
                      {comp.component_type === 'HEADER' && (
                        <div className="w-full h-full border-b-2 border-gray-900 pb-1 flex flex-col justify-center">
                          <h1 className="text-base font-bold tracking-wide text-gray-900">
                            {comp.content_json?.title || 'SHRI SANWARIYA ROAD LINES'}
                          </h1>
                          <p className="text-[10px] text-gray-600">
                            {comp.content_json?.subtitle || 'FLEET OWNERS & TRANSPORT CONTRACTORS • FULL TRUCK LOAD (FTL)'}
                          </p>
                        </div>
                      )}

                      {comp.component_type === 'TEXT' && (
                        <div
                          className="w-full h-full text-xs"
                          style={{
                            fontSize: `${comp.style_json?.font_size || 10}px`,
                            fontWeight: comp.style_json?.font_weight || 'normal',
                            textAlign: comp.style_json?.alignment || 'left',
                            color: comp.style_json?.color || '#111827',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {comp.content_json?.text ||
                            (comp.content_json?.template_text
                              ? comp.content_json.template_text
                                  .replace(/\{\{party\.name\}\}/g, 'Sample Logistics Private Limited')
                                  .replace(/\{\{bill\.bill_number\}\}/g, 'SRL/26-27/042')
                                  .replace(/\{\{bill\.bill_date\}\}/g, '2026-04-15')
                                  .replace(/\{\{bill\.total_amount\}\}/g, '₹ 92,000')
                              : `[Text: ${comp.component_key}]`)}
                        </div>
                      )}

                      {comp.component_type === 'TABLE' && (
                        <div className="w-full h-full border border-gray-400 text-[10px] flex flex-col">
                          <div className="bg-gray-100 border-b border-gray-400 flex font-bold py-1 px-1">
                            <div className="w-8">#</div>
                            <div className="flex-1">Description / Route</div>
                            <div className="w-24">Trip No.</div>
                            <div className="w-24">Vehicle No.</div>
                            <div className="w-20 text-right">Freight (₹)</div>
                          </div>
                          <div className="divide-y divide-gray-200">
                            <div className="flex py-1 px-1">
                              <div className="w-8">1</div>
                              <div className="flex-1">Mundra Port to Jaipur Depot</div>
                              <div className="w-24 font-mono">TRP-2026-001</div>
                              <div className="w-24 font-mono">GJ-12-BT-1234</div>
                              <div className="w-20 text-right font-mono">52,000.00</div>
                            </div>
                            <div className="flex py-1 px-1">
                              <div className="w-8">2</div>
                              <div className="flex-1">Kandla to Ahmedabad Hub</div>
                              <div className="w-24 font-mono">TRP-2026-002</div>
                              <div className="w-24 font-mono">GJ-12-XY-9876</div>
                              <div className="w-20 text-right font-mono">40,000.00</div>
                            </div>
                          </div>
                          <div className="mt-auto bg-gray-50 border-t border-gray-300 flex justify-between py-1 px-2 font-bold">
                            <span>Subtotal / Total Freight:</span>
                            <span className="font-mono">₹ 92,000.00</span>
                          </div>
                        </div>
                      )}

                      {comp.component_type === 'BORDER' && (
                        <div className="w-full h-full border-2 border-gray-800 rounded-xs" />
                      )}

                      {comp.component_type === 'LINE' && (
                        <div className="w-full border-b border-gray-400 my-auto" />
                      )}

                      {['LOGO', 'IMAGE', 'SIGNATURE', 'STAMP'].includes(comp.component_type) && (
                        <div className="w-full h-full border border-dashed border-gray-400 bg-gray-50 flex items-center justify-center p-1 text-[9px] text-gray-500 font-medium">
                          <span>[{comp.content_json?.label || comp.component_type}: {comp.component_key}]</span>
                        </div>
                      )}

                      {comp.component_type === 'FOOTER' && (
                        <div className="w-full h-full border-t border-gray-300 pt-1 text-[9px] text-gray-600 flex justify-between items-center">
                          <span>{comp.content_json?.text || 'SUBJECT TO GANDHIDHAM JURISDICTION • COMPUTER GENERATED INVOICE'}</span>
                          <span>Page 1 of 1</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: JSON DATA & TOKENS */}
          {!isLoading && !error && viewMode === 'JSON' && jsonData && (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200">
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

              <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200">
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
