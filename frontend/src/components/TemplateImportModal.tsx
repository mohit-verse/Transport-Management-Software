import React, { useState } from 'react';
import { Upload, X, AlertTriangle, CheckCircle, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { importBillTemplate, type TemplateImportResult } from '../services/api';
import { Button } from './Button';

interface TemplateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (imported: TemplateImportResult) => void;
}

export const TemplateImportModal: React.FC<TemplateImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TemplateImportResult | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        setError('File size exceeds the 10 MB limit.');
        setFile(null);
        return;
      }
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedMimes.includes(selected.type)) {
        setError('Only PDF, PNG, and JPEG documents are supported.');
        setFile(null);
        return;
      }
      setError(null);
      setFile(selected);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file to import.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const response = await importBillTemplate({
            file_name: file.name,
            file_content_base64: base64Data,
            mime_type: file.type as 'application/pdf' | 'image/jpeg' | 'image/png',
          });
          setResult(response.data);
        } catch (err: any) {
          setError(
            err.response?.data?.message || 'Failed to import reference template. Please verify the document format.'
          );
        } finally {
          setIsSubmitting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while reading the file.');
      setIsSubmitting(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onImportSuccess(result);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Import Reference Bill Template</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-full hover:bg-gray-100"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Guidance Banner */}
        <div className="bg-amber-50 px-6 py-3 border-b border-amber-100 text-xs text-amber-800 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Architectural Non-Negotiable Rule:</p>
            <p>
              Imported documents are reconstructed into an <strong>editable draft component tree</strong>. The uploaded
              blank bill is <strong>NEVER</strong> used as a permanent static background image.
            </p>
            <p className="mt-1 text-amber-700">
              Scanned PDFs and raster images are reconstructed using geometric layout heuristics without OCR; text
              and field bindings must be reviewed and manually finalized in the designer.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!result ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  Select a reference bill document (PDF, PNG, or JPEG)
                </p>
                <p className="text-xs text-gray-500 mt-1">Maximum file size: 10 MB</p>

                <label className="mt-4 inline-block">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                    Choose Document
                  </span>
                </label>

                {file && (
                  <div className="mt-3 text-xs text-emerald-700 font-medium flex items-center justify-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-emerald-900">Reconstruction Succeeded</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      result.confidence === 'HIGH'
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-amber-200 text-amber-800'
                    }`}
                  >
                    Confidence: {result.confidence}
                  </span>
                </div>
                <p className="text-xs text-emerald-700">
                  Extracted <strong>{result.components.length}</strong> structured components and configured suggested layout.
                </p>
              </div>

              {result.warnings && result.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Import Notice:</span>
                  </div>
                  {result.warnings.map((warn, i) => (
                    <p key={i}>• {warn}</p>
                  ))}
                </div>
              )}

              <div className="border border-gray-200 rounded-md p-3 text-xs space-y-1 bg-gray-50">
                <div className="flex justify-between">
                  <span className="text-gray-500">Draft Name:</span>
                  <span className="font-medium text-gray-800">{result.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Template Type:</span>
                  <span className="font-medium text-gray-800">{result.template_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Component Count:</span>
                  <span className="font-medium text-gray-800">{result.components.length} components</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {!result ? (
            <Button onClick={handleImport} disabled={!file || isSubmitting}>
              {isSubmitting ? 'Analyzing & Reconstructing...' : 'Process Document'}
            </Button>
          ) : (
            <Button onClick={handleApply}>
              <Sparkles className="w-4 h-4 mr-1.5" />
              Open in Designer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
