import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Database, AlertCircle, Sparkles } from 'lucide-react';
import { getDynamicFields, type DynamicFieldDefinition } from '../services/api';
import { Button } from './Button';

interface DynamicFieldPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectField: (field: DynamicFieldDefinition, placeholder: string) => void;
  contextType?: 'ALL' | 'TRIP_ROW' | 'DESTINATION_ROW' | 'BILL';
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Categories' },
  { id: 'PARTY', label: 'Party' },
  { id: 'TRIP', label: 'Trip' },
  { id: 'VEHICLE', label: 'Vehicle' },
  { id: 'VEHICLE_OWNER', label: 'Vehicle Owner' },
  { id: 'JOURNEY', label: 'Journey' },
  { id: 'RECEIVABLES', label: 'Receivables' },
  { id: 'VEHICLE_OWNER_PAYABLES', label: 'Owner Payables' },
  { id: 'OWN_FLEET_EXPENSES', label: 'Own Fleet' },
  { id: 'POD', label: 'POD / LR' },
  { id: 'ISSUES', label: 'Issues' },
  { id: 'BILLING', label: 'Billing' },
  { id: 'PAYMENT', label: 'Payment' },
  { id: 'SYSTEM', label: 'System' },
  { id: 'CALCULATED', label: 'Calculated' },
];

export const DynamicFieldPickerModal: React.FC<DynamicFieldPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectField,
  contextType = 'ALL',
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [repeatableOnly, setRepeatableOnly] = useState<boolean>(
    contextType === 'TRIP_ROW' || contextType === 'DESTINATION_ROW'
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dynamic-fields', selectedCategory, search, repeatableOnly],
    queryFn: () =>
      getDynamicFields({
        source_entity: selectedCategory === 'ALL' ? undefined : selectedCategory,
        search: search.trim() || undefined,
        is_repeatable: repeatableOnly ? true : undefined,
      }),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const fields = data?.data || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Dynamic Field Directory</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-full hover:bg-gray-100"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currency & Formatting Notice */}
        <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 text-xs text-blue-800 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Formatting & Encoding Specification:</p>
            <p>
              Currency fields are deterministically formatted with standard <code>INR</code> prefix (e.g.{' '}
              <code>INR 1,25,000.00</code>) for PDF-1.4 Type 1 compatibility. Native <code>₹</code> and Indic script
              printing are not currently supported by Type 1 standard fonts.
            </p>
            <p className="mt-1">
              <strong>Party Master Notice:</strong> Party PAN is not an approved Party Master field in SSRL; Vehicle Owner
              PAN is available under <code>VEHICLE_OWNER</code>.
            </p>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-4 border-b border-gray-200 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dynamic fields by key, label, or description..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="flex items-center text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={repeatableOnly}
                  onChange={(e) => setRepeatableOnly(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1.5"
                />
                Repeatable rows only
              </label>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex space-x-1 overflow-x-auto pb-1 scrollbar-thin">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-gray-100">
          {isLoading && (
            <div className="py-12 text-center text-sm text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              Loading canonical dynamic fields...
            </div>
          )}

          {isError && (
            <div className="py-12 text-center text-sm text-red-600">
              Failed to load dynamic fields. Please check backend connection.
            </div>
          )}

          {!isLoading && !isError && fields.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500">
              No matching dynamic fields found for the selected category or filter.
            </div>
          )}

          {!isLoading &&
            !isError &&
            fields.map((field) => {
              const token = `{{${field.source_entity.toLowerCase()}.${field.field_key}}}`;
              return (
                <div
                  key={field.id}
                  className="py-3 px-2 hover:bg-gray-50 rounded-md flex items-center justify-between group transition-colors"
                >
                  <div className="flex-1 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-gray-900">{field.field_label}</span>
                      <code className="text-xs bg-gray-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium">
                        {token}
                      </code>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                        {field.data_type}
                      </span>
                      {field.is_repeatable && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Repeatable
                        </span>
                      )}
                    </div>
                    {field.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onSelectField(field, token);
                      onClose();
                    }}
                    className="flex-shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    Insert
                  </Button>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs text-gray-500">
          <span>{fields.length} dynamic field(s) available</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
