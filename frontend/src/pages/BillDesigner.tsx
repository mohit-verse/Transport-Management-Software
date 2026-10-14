import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Eye,
  Sparkles,
  Plus,
  Trash2,
  Image as ImageIcon,
  Sliders,
  Type,
  Table as TableIcon,
  Minus,
  Square,
  FileText,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Upload,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { useAuthStore } from '../store/authStore';
import {
  getBillTemplate,
  createBillTemplate,
  updateBillTemplate,
  uploadTemplateAsset,
  deleteTemplateAsset,
  type BillTemplateComponent,
  type DynamicFieldBinding,
  type BillTemplateAsset,
  type DynamicFieldDefinition,
  type TemplateImportResult,
  type ComponentType,
} from '../services/api';
import { DynamicFieldPickerModal } from '../components/DynamicFieldPickerModal';
import { TemplateImportModal } from '../components/TemplateImportModal';
import { TemplatePreviewModal } from '../components/TemplatePreviewModal';

const DEFAULT_PAGE_WIDTH = 595; // A4 pt
const DEFAULT_PAGE_HEIGHT = 842; // A4 pt
const DEFAULT_MARGIN = 36; // 0.5 inch in pt

const PAGE_SIZE_PRESETS = [
  { label: 'A4 (210 x 297 mm)', width: 595, height: 842 },
  { label: 'Letter (8.5 x 11 in)', width: 612, height: 792 },
];

const COMPONENT_PALETTE: Array<{
  type: ComponentType;
  label: string;
  icon: React.ElementType;
  defaultW: number;
  defaultH: number;
}> = [
  { type: 'HEADER', label: 'Company Header', icon: Type, defaultW: 523, defaultH: 50 },
  { type: 'TEXT', label: 'Text Block', icon: FileText, defaultW: 240, defaultH: 40 },
  { type: 'TABLE', label: 'Trip Table', icon: TableIcon, defaultW: 523, defaultH: 150 },
  { type: 'LOGO', label: 'Logo', icon: ImageIcon, defaultW: 120, defaultH: 50 },
  { type: 'SIGNATURE', label: 'Signature', icon: FileText, defaultW: 140, defaultH: 60 },
  { type: 'STAMP', label: 'Company Stamp', icon: FileText, defaultW: 80, defaultH: 80 },
  { type: 'IMAGE', label: 'Custom Image', icon: ImageIcon, defaultW: 100, defaultH: 100 },
  { type: 'LINE', label: 'Horizontal Line', icon: Minus, defaultW: 523, defaultH: 2 },
  { type: 'BORDER', label: 'Border Box', icon: Square, defaultW: 523, defaultH: 80 },
  { type: 'FOOTER', label: 'Footer Notice', icon: FileText, defaultW: 523, defaultH: 40 },
  { type: 'PAGE_BREAK', label: 'Page Break', icon: Minus, defaultW: 523, defaultH: 20 },
];

export default function BillDesigner() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';

  const isEditMode = Boolean(id);

  // Core Template Form State
  const [templateName, setTemplateName] = useState('Untitled Bill Template');
  const [templateType, setTemplateType] = useState<'INDIVIDUAL' | 'CONSOLIDATED' | 'MULTI_PAGE'>(
    'CONSOLIDATED'
  );
  const [templateStatus, setTemplateStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT');

  // Page Layout State
  const [layout, setLayout] = useState({
    page_width: DEFAULT_PAGE_WIDTH,
    page_height: DEFAULT_PAGE_HEIGHT,
    orientation: 'PORTRAIT' as 'PORTRAIT' | 'LANDSCAPE',
    margin_top: DEFAULT_MARGIN,
    margin_bottom: DEFAULT_MARGIN,
    margin_left: DEFAULT_MARGIN,
    margin_right: DEFAULT_MARGIN,
    primary_font: 'Helvetica',
  });

  // Components State
  const [components, setComponents] = useState<BillTemplateComponent[]>([]);
  const [dynamicFields, setDynamicFields] = useState<DynamicFieldBinding[]>([]);
  const [assets, setAssets] = useState<BillTemplateAsset[]>([]);

  // Selection & UI State
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inspector' | 'page_setup' | 'layers'>('inspector');
  const [canvasZoom, setCanvasZoom] = useState<number>(0.9); // Scale factor for canvas view

  // Modals State
  const [isDynamicFieldModalOpen, setIsDynamicFieldModalOpen] = useState(false);
  const [dynamicFieldContext, setDynamicFieldContext] = useState<
    'ALL' | 'TRIP_ROW' | 'DESTINATION_ROW' | 'BILL'
  >('ALL');
  const [activeTargetTokenField, setActiveTargetTokenField] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);

  // Asset Upload State inside Drawer
  const [assetUploadType, setAssetUploadType] = useState<'LOGO' | 'SIGNATURE' | 'STAMP' | 'IMAGE'>('LOGO');
  const [assetUploadFile, setAssetUploadFile] = useState<File | null>(null);
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null);

  // Feedback State
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [heuristicWarningBanner, setHeuristicWarningBanner] = useState<string | null>(null);

  // Query template if edit mode
  const { data: templateData, isLoading: isTemplateLoading } = useQuery({
    queryKey: ['bill-template', id],
    queryFn: () => getBillTemplate(id!),
    enabled: isEditMode,
  });

  // Populate data in edit mode
  useEffect(() => {
    if (templateData?.data) {
      const t = templateData.data;
      setTemplateName(t.name);
      setTemplateType(t.template_type);
      setTemplateStatus(t.status);
      if (t.layout_json) {
        setLayout((prev) => ({
          ...prev,
          ...t.layout_json,
        }));
      }
      setComponents(t.components || []);
      setDynamicFields(t.dynamic_fields || []);
      setAssets(t.assets || []);
      if (t.components?.length > 0 && !selectedKey) {
        setSelectedKey(t.components[0].component_key);
      }
    }
  }, [templateData]);

  // Handle imported template passed via router state
  useEffect(() => {
    const imported = (location.state as any)?.importedTemplate as TemplateImportResult | undefined;
    if (imported && !isEditMode) {
      setTemplateName(imported.name || 'Imported Bill Template');
      setTemplateType(imported.template_type || 'CONSOLIDATED');
      if (imported.layout_json) {
        setLayout((prev) => ({
          ...prev,
          ...imported.layout_json,
        }));
      }
      setComponents(imported.components || []);
      setDynamicFields(imported.dynamic_fields || []);
      if (imported.components?.length > 0) {
        setSelectedKey(imported.components[0].component_key);
      }
      setHeuristicWarningBanner(
        `Template layout was heuristically reconstructed (Confidence: ${imported.confidence}). Text was extracted heuristically without OCR. This draft layout is fully editable and will NEVER be used as a static background image.`
      );
    }
  }, [location.state, isEditMode]);

  // Selected Component helper
  const selectedComponent = components.find((c) => c.component_key === selectedKey) || null;

  // Add Component handler
  const handleAddComponent = (paletteItem: (typeof COMPONENT_PALETTE)[number]) => {
    const count = components.filter((c) => c.component_type === paletteItem.type).length + 1;
    const key = `${paletteItem.type.toLowerCase()}_${count}`;

    // Compute cascaded position
    const lastY = components.reduce(
      (maxY, c) => Math.max(maxY, (c.position_y || 0) + (c.height || 0)),
      layout.margin_top
    );
    const newY = Math.min(lastY + 10, layout.page_height - layout.margin_bottom - paletteItem.defaultH);

    let initialContent: Record<string, any> = {};
    let initialStyle: Record<string, any> = {
      font_family: layout.primary_font,
      font_size: paletteItem.type === 'HEADER' ? 14 : 10,
      font_weight: paletteItem.type === 'HEADER' ? 'bold' : 'normal',
      alignment: 'left',
      color: '#111827',
    };

    if (paletteItem.type === 'TABLE') {
      initialContent = {
        repeatable_entity: 'TRIP_ROW',
        columns: [
          { header: 'Trip No.', field_key: '{{trip.trip_number}}', width: 70, align: 'left' },
          { header: 'Date', field_key: '{{trip.trip_date}}', width: 65, align: 'left' },
          { header: 'Vehicle No.', field_key: '{{vehicle.vehicle_number}}', width: 85, align: 'left' },
          { header: 'From - To', field_key: '{{journey.route_summary}}', width: 120, align: 'left' },
          { header: 'LR No.', field_key: '{{pod.lr_number}}', width: 70, align: 'left' },
          { header: 'Freight', field_key: '{{receivables.freight_amount}}', width: 75, align: 'right' },
          { header: 'Total', field_key: '{{receivables.total_receivable}}', width: 75, align: 'right' },
        ],
      };
      initialStyle = {
        header_bg: '#f3f4f6',
        row_height: 20,
        font_size: 9,
        border_width: 1,
      };
    } else if (paletteItem.type === 'HEADER') {
      initialContent = {
        text: 'SHRI SANWARIYA ROAD LINES\nFLEET OWNERS & TRANSPORT CONTRACTORS',
      };
      initialStyle.alignment = 'center';
    } else if (paletteItem.type === 'FOOTER') {
      initialContent = {
        text: 'Terms & Conditions: Subject to Udaipur Jurisdiction. This is a computer generated invoice.',
      };
      initialStyle.alignment = 'center';
      initialStyle.font_size = 8;
    } else if (paletteItem.type === 'TEXT') {
      initialContent = {
        text: 'Bill To: {{party.name}}\nGSTIN: {{party.gstin}}',
      };
    } else if (['LOGO', 'SIGNATURE', 'STAMP', 'IMAGE'].includes(paletteItem.type)) {
      initialContent = {
        asset_key: '',
        required: true,
      };
    } else if (paletteItem.type === 'LINE') {
      initialStyle = {
        stroke_width: 1,
        stroke_style: 'solid',
        color: '#9ca3af',
      };
    } else if (paletteItem.type === 'BORDER') {
      initialStyle = {
        stroke_width: 1,
        stroke_style: 'solid',
        color: '#d1d5db',
        fill_color: 'transparent',
      };
    }

    const newComponent: BillTemplateComponent = {
      component_type: paletteItem.type,
      component_key: key,
      position_x: layout.margin_left,
      position_y: newY,
      width: Math.min(paletteItem.defaultW, layout.page_width - layout.margin_left - layout.margin_right),
      height: paletteItem.defaultH,
      style_json: initialStyle,
      content_json: initialContent,
    };

    setComponents([...components, newComponent]);
    setSelectedKey(key);
    setActiveTab('inspector');
  };

  // Update selected component
  const updateSelectedComponent = (patch: Partial<BillTemplateComponent>) => {
    if (!selectedKey) return;
    setComponents((prev) =>
      prev.map((c) => {
        if (c.component_key === selectedKey) {
          return {
            ...c,
            ...patch,
            style_json: patch.style_json
              ? { ...c.style_json, ...patch.style_json }
              : c.style_json,
            content_json: patch.content_json
              ? { ...c.content_json, ...patch.content_json }
              : c.content_json,
          };
        }
        return c;
      })
    );
  };

  // Remove component
  const handleDeleteComponent = (keyToDelete: string) => {
    setComponents((prev) => prev.filter((c) => c.component_key !== keyToDelete));
    if (selectedKey === keyToDelete) {
      setSelectedKey(null);
    }
  };

  // Move component in layer stack
  const handleMoveLayer = (key: string, direction: 'up' | 'down') => {
    const idx = components.findIndex((c) => c.component_key === key);
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      const next = [...components];
      const temp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = temp;
      setComponents(next);
    } else if (direction === 'down' && idx < components.length - 1) {
      const next = [...components];
      const temp = next[idx + 1];
      next[idx + 1] = next[idx];
      next[idx] = temp;
      setComponents(next);
    }
  };

  // Dynamic field selection callback
  const handleSelectDynamicField = (
    field: DynamicFieldDefinition,
    placeholderToken: string
  ) => {
    setIsDynamicFieldModalOpen(false);

    // Register binding if not present
    if (!dynamicFields.some((b) => b.field_definition_id === field.id)) {
      setDynamicFields([
        ...dynamicFields,
        {
          field_definition_id: field.id,
          binding_path: placeholderToken.replace(/[{}]/g, ''),
          display_label: field.field_label,
          is_repeatable: field.is_repeatable,
        },
      ]);
    }

    if (!selectedComponent) return;

    // If target is a table column field
    if (activeTargetTokenField?.startsWith('col_')) {
      const colIdx = parseInt(activeTargetTokenField.replace('col_', ''), 10);
      const cols = [...(selectedComponent.content_json?.columns || [])];
      if (cols[colIdx]) {
        cols[colIdx].field_key = placeholderToken;
        updateSelectedComponent({
          content_json: { ...selectedComponent.content_json, columns: cols },
        });
      }
      setActiveTargetTokenField(null);
      return;
    }

    // Default: append or insert token into text content
    const existingText = selectedComponent.content_json?.text || '';
    const updatedText = existingText ? `${existingText} ${placeholderToken}` : placeholderToken;
    updateSelectedComponent({
      content_json: { ...selectedComponent.content_json, text: updatedText },
    });
  };

  // Validate template before saving
  const validateTemplate = (): string[] => {
    const errs: string[] = [];
    if (!templateName.trim()) {
      errs.push('Template name is required.');
    }
    const keys = components.map((c) => c.component_key);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      errs.push(`Duplicate component keys detected: ${Array.from(new Set(duplicates)).join(', ')}`);
    }

    components.forEach((c) => {
      if ((c.position_x ?? 0) < 0 || (c.position_y ?? 0) < 0) {
        errs.push(`Component '${c.component_key}' has negative coordinates.`);
      }
      if ((c.width ?? 0) <= 0 || (c.height ?? 0) <= 0) {
        errs.push(`Component '${c.component_key}' has zero or negative dimensions.`);
      }
      if (['LOGO', 'SIGNATURE', 'STAMP'].includes(c.component_type)) {
        if (c.content_json?.required && !c.content_json?.asset_key && assets.length === 0) {
          errs.push(
            `Component '${c.component_key}' is marked Required, but no template asset is bound.`
          );
        }
      }
    });

    return errs;
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: templateName.trim(),
        template_type: templateType,
        status: templateStatus,
        layout_json: layout,
        components,
        dynamic_fields: dynamicFields,
      };

      if (isEditMode) {
        return updateBillTemplate(id!, payload);
      } else {
        return createBillTemplate(payload);
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['bill-templates'] });
      setSaveSuccessMessage('Template saved successfully!');
      setValidationErrors([]);
      setTimeout(() => setSaveSuccessMessage(null), 4000);

      if (!isEditMode && res.data?.id) {
        navigate(`/settings/billing/templates/${res.data.id}/edit`, { replace: true });
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save template.';
      setValidationErrors([msg]);
    },
  });

  const handleSave = () => {
    const errors = validateTemplate();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    saveMutation.mutate();
  };

  // Asset Upload
  const handleUploadAsset = async () => {
    if (!id) {
      setAssetUploadError('Please save the template first before uploading assets.');
      return;
    }
    if (!assetUploadFile) {
      setAssetUploadError('Please select an image file to upload.');
      return;
    }

    setAssetUploadError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const res = await uploadTemplateAsset(id, {
            asset_type: assetUploadType,
            file_name: assetUploadFile.name,
            file_content_base64: base64,
            mime_type: assetUploadFile.type,
          });

          if (res.data) {
            setAssets([...assets, res.data]);
            setAssetUploadFile(null);
            // If currently selected component is of this asset type, prebind it
            if (
              selectedComponent &&
              selectedComponent.component_type === assetUploadType &&
              !selectedComponent.content_json?.asset_key
            ) {
              updateSelectedComponent({
                content_json: {
                  ...selectedComponent.content_json,
                  asset_key: res.data.storage_key,
                },
              });
            }
          }
        } catch (err: any) {
          setAssetUploadError(err?.response?.data?.message || 'Failed to upload asset.');
        }
      };
      reader.readAsDataURL(assetUploadFile);
    } catch {
      setAssetUploadError('Failed to read file.');
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!id) return;
    try {
      await deleteTemplateAsset(id, assetId);
      setAssets(assets.filter((a) => a.id !== assetId));
    } catch (err: any) {
      setAssetUploadError(err?.response?.data?.message || 'Failed to delete asset.');
    }
  };

  if (isEditMode && isTemplateLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          Loading bill designer...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* TOP APPLICATION BAR */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/settings/billing')}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            title="Back to Billing Settings"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                disabled={!isOwner}
                placeholder="Template Name"
                className="text-base font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent px-1 py-0.5 rounded"
              />
              <StatusBadge status={templateStatus} />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{templateType}</span>
              <span>•</span>
              <span>{components.length} components</span>
              <span>•</span>
              <span>{dynamicFields.length} bound fields</span>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Zoom controls */}
          <div className="hidden md:flex items-center gap-1 bg-gray-100 rounded-md p-0.5 border border-gray-200 mr-2">
            <button
              type="button"
              onClick={() => setCanvasZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-1 text-gray-600 hover:text-gray-900 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-1.5 text-gray-700">
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setCanvasZoom((z) => Math.min(1.5, z + 0.1))}
              className="p-1 text-gray-600 hover:text-gray-900 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Reference Import (Owner only) */}
          {isOwner && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Import Reference</span>
            </Button>
          )}

          {/* Assets Manager */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsAssetDrawerOpen(true)}
            className="flex items-center gap-1.5"
          >
            <ImageIcon className="w-4 h-4 text-indigo-500" />
            <span className="hidden sm:inline">Assets</span> ({assets.length})
          </Button>

          {/* Non-mutating Preview */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsPreviewModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4 text-blue-600" />
            Preview
          </Button>

          {/* Save Button (Owner only) */}
          {isOwner && (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          )}
        </div>
      </header>

      {/* HEURISTIC IMPORT ALERT BANNER */}
      {heuristicWarningBanner && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{heuristicWarningBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setHeuristicWarningBanner(null)}
            className="text-amber-700 hover:text-amber-900 font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* VALIDATION & ERROR BANNERS */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-800 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-600" />
            Please correct the following template errors:
          </div>
          <ul className="list-disc pl-5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {saveSuccessMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* MAIN DESIGNER THREE-PANE WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: COMPONENT TOOLBOX & LAYER LIST */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-10">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Toolbox
            </span>
            <span className="text-[10px] text-gray-400">Click to add</span>
          </div>

          {/* Palette buttons */}
          <div className="p-3 overflow-y-auto flex-1 space-y-1.5">
            {COMPONENT_PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => handleAddComponent(item)}
                disabled={!isOwner}
                className="w-full text-left px-3 py-2 rounded-md border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center gap-2.5 text-xs text-gray-700 transition-colors disabled:opacity-50"
              >
                <item.icon className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}

            {/* Layer Stack Accordion */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Components ({components.length})
                </span>
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {components.map((comp, idx) => (
                  <div
                    key={comp.component_key}
                    onClick={() => {
                      setSelectedKey(comp.component_key);
                      setActiveTab('inspector');
                    }}
                    className={`px-2.5 py-1.5 rounded text-xs flex items-center justify-between cursor-pointer border ${
                      selectedKey === comp.component_key
                        ? 'bg-blue-50 border-blue-400 text-blue-900 font-medium'
                        : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                      {comp.component_type === 'PAGE_BREAK' && (
                        <span className="px-1 py-0.5 text-[8px] font-bold bg-red-100 text-red-700 rounded uppercase">Break</span>
                      )}
                      <span className="truncate">{comp.component_key}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-70 hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveLayer(comp.component_key, 'up');
                        }}
                        disabled={idx === 0}
                        className="p-0.5 hover:text-blue-600 disabled:opacity-30"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveLayer(comp.component_key, 'down');
                        }}
                        disabled={idx === components.length - 1}
                        className="p-0.5 hover:text-blue-600 disabled:opacity-30"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteComponent(comp.component_key);
                          }}
                          className="p-0.5 text-red-500 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER PANE: INTERACTIVE CANVASES WITH PAPER MARGINS */}
        <main className="flex-1 bg-gray-200 overflow-auto p-8 flex justify-center items-start">
          <div
            className="bg-white shadow-2xl relative select-none transition-transform duration-100 origin-top"
            style={{
              width: `${layout.page_width}px`,
              height: `${layout.page_height}px`,
              transform: `scale(${canvasZoom})`,
            }}
          >
            {/* Visual Margin Boundaries (dashed guides) */}
            <div
              className="absolute pointer-events-none border border-dashed border-blue-200"
              style={{
                top: `${layout.margin_top}px`,
                bottom: `${layout.margin_bottom}px`,
                left: `${layout.margin_left}px`,
                right: `${layout.margin_right}px`,
              }}
            >
              <span className="absolute -top-4 left-0 text-[9px] text-blue-300 font-mono">
                Print Area Margin
              </span>
            </div>

            {/* Rendered Components on Canvas */}
            {components.map((comp) => {
              const isSelected = comp.component_key === selectedKey;
              const x = comp.position_x ?? 0;
              const y = comp.position_y ?? 0;
              const w = comp.width ?? 100;
              const h = comp.height ?? 30;

              return (
                <div
                  key={comp.component_key}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedKey(comp.component_key);
                    setActiveTab('inspector');
                  }}
                  className={`absolute group cursor-pointer transition-shadow rounded-sm ${
                    isSelected
                      ? 'ring-2 ring-blue-500 bg-blue-50/20 z-20 shadow-md'
                      : 'hover:ring-1 hover:ring-gray-400 z-10'
                  }`}
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${w}px`,
                    height: `${h}px`,
                  }}
                >
                  {/* Selected Tag & Dimensions indicator */}
                  {isSelected && (
                    <div className="absolute -top-5 left-0 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 z-30">
                      <span>{comp.component_key}</span>
                      <span>({Math.round(w)}×{Math.round(h)})</span>
                    </div>
                  )}

                  {/* Component Preview Content inside bounding box */}
                  <div className="w-full h-full p-1 overflow-hidden pointer-events-none text-xs flex flex-col justify-center">
                    {/* TEXT / HEADER / FOOTER */}
                    {['TEXT', 'HEADER', 'FOOTER'].includes(comp.component_type) && (
                      <div
                        style={{
                          fontFamily: comp.style_json?.font_family || layout.primary_font,
                          fontSize: `${comp.style_json?.font_size || 10}px`,
                          fontWeight: comp.style_json?.font_weight || 'normal',
                          textAlign: comp.style_json?.alignment || 'left',
                          color: comp.style_json?.color || '#111827',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.2',
                        }}
                      >
                        {comp.content_json?.text || `[${comp.component_type}: ${comp.component_key}]`}
                      </div>
                    )}

                    {/* TABLE */}
                    {comp.component_type === 'TABLE' && (
                      <div className="w-full h-full flex flex-col border border-gray-300 bg-white">
                        <div className="bg-gray-100 border-b border-gray-300 flex text-[9px] font-semibold text-gray-700 py-1 px-1">
                          {(comp.content_json?.columns || []).map((col: any, ci: number) => (
                            <div
                              key={ci}
                              style={{ width: `${col.width}px` }}
                              className={`truncate px-1 text-${col.align || 'left'}`}
                            >
                              {col.header}
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 divide-y divide-gray-100 text-[8px] text-gray-500 overflow-hidden">
                          <div className="flex py-1 px-1 bg-white">
                            {(comp.content_json?.columns || []).map((col: any, ci: number) => (
                              <div
                                key={ci}
                                style={{ width: `${col.width}px` }}
                                className={`truncate px-1 font-mono text-${col.align || 'left'}`}
                              >
                                {col.field_key || '-'}
                              </div>
                            ))}
                          </div>
                          <div className="flex py-1 px-1 bg-gray-50/50">
                            <span className="italic text-gray-400 px-1">
                              [Repeatable rows rendered dynamically from trip data]
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* LINE */}
                    {comp.component_type === 'LINE' && (
                      <div
                        className="w-full"
                        style={{
                          height: `${comp.style_json?.stroke_width || 1}px`,
                          backgroundColor: comp.style_json?.color || '#9ca3af',
                          borderTopStyle: comp.style_json?.stroke_style || 'solid',
                        }}
                      />
                    )}

                    {/* BORDER */}
                    {comp.component_type === 'BORDER' && (
                      <div
                        className="w-full h-full"
                        style={{
                          borderWidth: `${comp.style_json?.stroke_width || 1}px`,
                          borderStyle: comp.style_json?.stroke_style || 'solid',
                          borderColor: comp.style_json?.color || '#d1d5db',
                          backgroundColor: comp.style_json?.fill_color || 'transparent',
                        }}
                      />
                    )}

                    {/* LOGO / SIGNATURE / STAMP / IMAGE */}
                    {['LOGO', 'SIGNATURE', 'STAMP', 'IMAGE'].includes(comp.component_type) && (
                      <div className="w-full h-full border border-dashed border-gray-300 bg-gray-50 rounded flex flex-col items-center justify-center text-center p-1">
                        <ImageIcon className="w-4 h-4 text-gray-400 mb-0.5" />
                        <span className="text-[9px] font-medium text-gray-600 truncate max-w-full">
                          {comp.component_type}
                        </span>
                        {comp.content_json?.asset_key ? (
                          <span className="text-[8px] text-emerald-600 truncate max-w-full font-mono">
                            Bound: {comp.content_json.asset_key.split('/').pop()}
                          </span>
                        ) : (
                          <span className="text-[8px] text-amber-600">No Asset Bound</span>
                        )}
                      </div>
                    )}

                    {/* PAGE BREAK */}
                    {comp.component_type === 'PAGE_BREAK' && (
                      <div className="w-full h-full border-b-2 border-dashed border-red-400 flex items-center justify-center bg-red-50/50 text-[9px] text-red-600 font-bold uppercase tracking-wider select-none px-2 text-center">
                        --- Page Break (Subsequent elements start on next page) ---
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* RIGHT PANE: PROPERTY INSPECTOR & PAGE SETUP */}
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 z-10 overflow-y-auto">
          {/* Tabs */}
          <div className="border-b border-gray-200 flex bg-gray-50">
            <button
              type="button"
              onClick={() => setActiveTab('inspector')}
              className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 ${
                activeTab === 'inspector'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Element Inspector
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('page_setup')}
              className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 ${
                activeTab === 'page_setup'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Page Setup
            </button>
          </div>

          <div className="p-4 space-y-5">
            {/* TAB: SELECTED ELEMENT INSPECTOR */}
            {activeTab === 'inspector' && (
              <>
                {selectedComponent ? (
                  <div className="space-y-4">
                    {/* Header info */}
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                      <div>
                        <span className="text-xs font-bold text-gray-900">
                          {selectedComponent.component_type}
                        </span>
                        <p className="text-[10px] text-gray-400 font-mono">
                          Key: {selectedComponent.component_key}
                        </p>
                      </div>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComponent(selectedComponent.component_key)}
                          className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Component Key field */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Component Identifier
                      </label>
                      <input
                        type="text"
                        value={selectedComponent.component_key}
                        onChange={(e) =>
                          updateSelectedComponent({ component_key: e.target.value })
                        }
                        disabled={!isOwner}
                        className="w-full text-xs rounded border border-gray-300 py-1.5 px-2 focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>

                    {/* Numeric Position & Dimensions (Avoiding drag-and-drop bugs) */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-2">
                        Geometry & Coordinates (pt)
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-gray-500">X Position</span>
                          <input
                            type="number"
                            value={selectedComponent.position_x ?? 0}
                            onChange={(e) =>
                              updateSelectedComponent({
                                position_x: parseFloat(e.target.value) || 0,
                              })
                            }
                            disabled={!isOwner}
                            className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500">Y Position</span>
                          <input
                            type="number"
                            value={selectedComponent.position_y ?? 0}
                            onChange={(e) =>
                              updateSelectedComponent({
                                position_y: parseFloat(e.target.value) || 0,
                              })
                            }
                            disabled={!isOwner}
                            className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500">Width</span>
                          <input
                            type="number"
                            value={selectedComponent.width ?? 0}
                            onChange={(e) =>
                              updateSelectedComponent({
                                width: parseFloat(e.target.value) || 0,
                              })
                            }
                            disabled={!isOwner}
                            className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500">Height</span>
                          <input
                            type="number"
                            value={selectedComponent.height ?? 0}
                            onChange={(e) =>
                              updateSelectedComponent({
                                height: parseFloat(e.target.value) || 0,
                              })
                            }
                            disabled={!isOwner}
                            className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* TEXT & TYPOGRAPHY SETTINGS */}
                    {['TEXT', 'HEADER', 'FOOTER'].includes(selectedComponent.component_type) && (
                      <div className="pt-3 border-t border-gray-200 space-y-3">
                        <label className="block text-xs font-semibold text-gray-800">
                          Typography & Style
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-gray-500">Font Family</span>
                            <select
                              value={selectedComponent.style_json?.font_family || layout.primary_font}
                              onChange={(e) =>
                                updateSelectedComponent({
                                  style_json: { font_family: e.target.value },
                                })
                              }
                              disabled={!isOwner}
                              className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                            >
                              <option value="Helvetica">Helvetica</option>
                              <option value="Times-Roman">Times-Roman</option>
                              <option value="Courier">Courier</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500">Font Size (pt)</span>
                            <input
                              type="number"
                              value={selectedComponent.style_json?.font_size || 10}
                              onChange={(e) =>
                                updateSelectedComponent({
                                  style_json: { font_size: parseInt(e.target.value, 10) || 10 },
                                })
                              }
                              disabled={!isOwner}
                              className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500">Weight</span>
                            <select
                              value={selectedComponent.style_json?.font_weight || 'normal'}
                              onChange={(e) =>
                                updateSelectedComponent({
                                  style_json: { font_weight: e.target.value },
                                })
                              }
                              disabled={!isOwner}
                              className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                            >
                              <option value="normal">Normal</option>
                              <option value="bold">Bold</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500">Alignment</span>
                            <select
                              value={selectedComponent.style_json?.alignment || 'left'}
                              onChange={(e) =>
                                updateSelectedComponent({
                                  style_json: { alignment: e.target.value },
                                })
                              }
                              disabled={!isOwner}
                              className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>

                        {/* Content Template Text Editor */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">Text Content</span>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTargetTokenField('text');
                                  setDynamicFieldContext('BILL');
                                  setIsDynamicFieldModalOpen(true);
                                }}
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Insert Dynamic Field
                              </button>
                            )}
                          </div>
                          <textarea
                            rows={4}
                            value={selectedComponent.content_json?.text || ''}
                            onChange={(e) =>
                              updateSelectedComponent({
                                content_json: { text: e.target.value },
                              })
                            }
                            disabled={!isOwner}
                            className="w-full text-xs font-mono rounded border border-gray-300 p-2 focus:ring-1 focus:ring-blue-500"
                            placeholder="Type text or use {{entity.field_key}} tokens..."
                          />
                        </div>

                        {/* Reminders / helper notes */}
                        <div className="p-2 bg-blue-50 rounded text-[10px] text-blue-800 space-y-1">
                          <p>
                            <strong>Font Note:</strong> Standard Type 1 PostScript fonts render
                            currency using the prefix <code>INR</code> rather than the ₹ symbol.
                          </p>
                          <p>
                            <strong>PAN Note:</strong> PAN is only tracked on Vehicle Owners; not on
                            Parties.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* TABLE PROPERTIES */}
                    {selectedComponent.component_type === 'TABLE' && (
                      <div className="pt-3 border-t border-gray-200 space-y-3">
                        <label className="block text-xs font-semibold text-gray-800">
                          Table Columns Configuration
                        </label>
                        <p className="text-[10px] text-gray-500">
                          Configures repeatable row bindings for consolidated trip billing.
                        </p>

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {(selectedComponent.content_json?.columns || []).map(
                            (col: any, cidx: number) => (
                              <div
                                key={cidx}
                                className="p-2 bg-gray-50 border border-gray-200 rounded text-xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-gray-700">
                                    Column {cidx + 1}
                                  </span>
                                  {isOwner && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cols = [
                                          ...(selectedComponent.content_json?.columns || []),
                                        ];
                                        cols.splice(cidx, 1);
                                        updateSelectedComponent({
                                          content_json: {
                                            ...selectedComponent.content_json,
                                            columns: cols,
                                          },
                                        });
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                      title="Remove Column"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <span className="text-[9px] text-gray-500">Header</span>
                                    <input
                                      type="text"
                                      value={col.header}
                                      onChange={(e) => {
                                        const cols = [
                                          ...(selectedComponent.content_json?.columns || []),
                                        ];
                                        cols[cidx].header = e.target.value;
                                        updateSelectedComponent({
                                          content_json: {
                                            ...selectedComponent.content_json,
                                            columns: cols,
                                          },
                                        });
                                      }}
                                      disabled={!isOwner}
                                      className="w-full text-xs rounded border border-gray-300 py-0.5 px-1.5"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-gray-500">Width (pt)</span>
                                    <input
                                      type="number"
                                      value={col.width}
                                      onChange={(e) => {
                                        const cols = [
                                          ...(selectedComponent.content_json?.columns || []),
                                        ];
                                        cols[cidx].width = parseFloat(e.target.value) || 50;
                                        updateSelectedComponent({
                                          content_json: {
                                            ...selectedComponent.content_json,
                                            columns: cols,
                                          },
                                        });
                                      }}
                                      disabled={!isOwner}
                                      className="w-full text-xs rounded border border-gray-300 py-0.5 px-1.5"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-gray-500">Field Token</span>
                                    {isOwner && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveTargetTokenField(`col_${cidx}`);
                                          setDynamicFieldContext('TRIP_ROW');
                                          setIsDynamicFieldModalOpen(true);
                                        }}
                                        className="text-[9px] text-blue-600 hover:underline"
                                      >
                                        Pick Field
                                      </button>
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    value={col.field_key}
                                    onChange={(e) => {
                                      const cols = [
                                        ...(selectedComponent.content_json?.columns || []),
                                      ];
                                      cols[cidx].field_key = e.target.value;
                                      updateSelectedComponent({
                                        content_json: {
                                          ...selectedComponent.content_json,
                                          columns: cols,
                                        },
                                      });
                                    }}
                                    disabled={!isOwner}
                                    className="w-full text-xs font-mono rounded border border-gray-300 py-0.5 px-1.5"
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        {isOwner && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const cols = [
                                ...(selectedComponent.content_json?.columns || []),
                                { header: 'New Col', field_key: '{{trip.custom}}', width: 70, align: 'left' },
                              ];
                              updateSelectedComponent({
                                content_json: {
                                  ...selectedComponent.content_json,
                                  columns: cols,
                                },
                              });
                            }}
                            className="w-full text-xs flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Table Column
                          </Button>
                        )}
                      </div>
                    )}

                    {/* ASSET BINDING PROPERTIES (LOGO, SIGNATURE, STAMP) */}
                    {['LOGO', 'SIGNATURE', 'STAMP', 'IMAGE'].includes(
                      selectedComponent.component_type
                    ) && (
                      <div className="pt-3 border-t border-gray-200 space-y-3">
                        <label className="block text-xs font-semibold text-gray-800">
                          Asset Binding & Requirement
                        </label>

                        <div>
                          <span className="text-[10px] text-gray-500 block mb-1">
                            Bound Template Asset
                          </span>
                          <select
                            value={selectedComponent.content_json?.asset_key || ''}
                            onChange={(e) =>
                              updateSelectedComponent({
                                content_json: {
                                  ...selectedComponent.content_json,
                                  asset_key: e.target.value,
                                },
                              })
                            }
                            disabled={!isOwner}
                            className="w-full rounded border border-gray-300 py-1.5 px-2 text-xs"
                          >
                            <option value="">-- No Asset Assigned --</option>
                            {assets
                              .filter(
                                (a) =>
                                  a.asset_type === selectedComponent.component_type ||
                                  selectedComponent.component_type === 'IMAGE'
                              )
                              .map((a) => (
                                <option key={a.id} value={a.storage_key}>
                                  {a.file_name} ({a.asset_type})
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Required Asset Flag */}
                        <div className="pt-2">
                          <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedComponent.content_json?.required ?? true}
                              onChange={(e) =>
                                updateSelectedComponent({
                                  content_json: {
                                    ...selectedComponent.content_json,
                                    required: e.target.checked,
                                  },
                                })
                              }
                              disabled={!isOwner}
                              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                              <strong>Required Asset</strong>
                            </span>
                          </label>
                          <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-900 flex items-start gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <span>
                              If marked Required, PDF generation will explicitly fail if this asset
                              is missing from storage, rather than silently omitting it.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* LINE & BORDER PROPERTIES */}
                    {['LINE', 'BORDER'].includes(selectedComponent.component_type) && (
                      <div className="pt-3 border-t border-gray-200 space-y-3">
                        <label className="block text-xs font-semibold text-gray-800">
                          Stroke & Styling
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-gray-500">Stroke Width (pt)</span>
                            <input
                              type="number"
                              value={selectedComponent.style_json?.stroke_width || 1}
                              onChange={(e) =>
                                updateSelectedComponent({
                                  style_json: { stroke_width: parseFloat(e.target.value) || 1 },
                                })
                              }
                              disabled={!isOwner}
                              className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500">Stroke Style</span>
                            <select
                              value={selectedComponent.style_json?.stroke_style || 'solid'}
                              onChange={(e) =>
                                updateSelectedComponent({
                                  style_json: { stroke_style: e.target.value },
                                })
                              }
                              disabled={!isOwner}
                              className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                            >
                              <option value="solid">Solid</option>
                              <option value="dashed">Dashed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE BREAK PROPERTIES */}
                    {selectedComponent.component_type === 'PAGE_BREAK' && (
                      <div className="pt-3 border-t border-gray-200 space-y-3">
                        <label className="block text-xs font-semibold text-gray-800">
                          Page Break Semantics
                        </label>
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-900 space-y-2">
                          <p className="font-semibold text-red-800 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-red-600" />
                            Multi-Page Boundary
                          </p>
                          <p className="text-[11px] leading-relaxed text-red-700">
                            This element marks a page boundary. In the generated PDF, all components defined before this break belong to the current page, and all subsequent components start on the next page in component order.
                          </p>
                          <ul className="text-[10px] space-y-1 list-disc list-inside text-red-600 pt-1">
                            <li><strong>Table Continuation:</strong> Tables with more than 22 items continue automatically across additional pages with continuation headers.</li>
                            <li><strong>Blank Page Protection:</strong> Consecutive breaks or breaks at the beginning/end of the document are automatically collapsed to prevent blank pages.</li>
                            <li><strong>Authoritative Totals:</strong> Financial totals and legal billing footers are rendered on the terminal page.</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Sliders className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-medium text-gray-600">No element selected</p>
                    <p className="text-[10px] text-gray-400 mt-1 max-w-[180px] mx-auto">
                      Click any element on the canvas or layer list to inspect its properties.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* TAB: PAGE SETUP */}
            {activeTab === 'page_setup' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">
                    Page Size Preset
                  </label>
                  <select
                    value={`${layout.page_width}x${layout.page_height}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      setLayout((prev) => ({
                        ...prev,
                        page_width: w,
                        page_height: h,
                      }));
                    }}
                    disabled={!isOwner}
                    className="w-full rounded border border-gray-300 py-1.5 px-2 text-xs"
                  >
                    {PAGE_SIZE_PRESETS.map((p) => (
                      <option key={p.label} value={`${p.width}x${p.height}`}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Orientation</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (layout.orientation !== 'PORTRAIT') {
                          setLayout((prev) => ({
                            ...prev,
                            orientation: 'PORTRAIT',
                            page_width: Math.min(prev.page_width, prev.page_height),
                            page_height: Math.max(prev.page_width, prev.page_height),
                          }));
                        }
                      }}
                      className={`py-1.5 text-center border rounded ${
                        layout.orientation === 'PORTRAIT'
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (layout.orientation !== 'LANDSCAPE') {
                          setLayout((prev) => ({
                            ...prev,
                            orientation: 'LANDSCAPE',
                            page_width: Math.max(prev.page_width, prev.page_height),
                            page_height: Math.min(prev.page_width, prev.page_height),
                          }));
                        }
                      }}
                      className={`py-1.5 text-center border rounded ${
                        layout.orientation === 'LANDSCAPE'
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>

                {/* Margins */}
                <div className="pt-2 border-t border-gray-200">
                  <label className="block font-semibold text-gray-800 mb-2">
                    Margins (pt)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-500">Top</span>
                      <input
                        type="number"
                        value={layout.margin_top}
                        onChange={(e) =>
                          setLayout((prev) => ({
                            ...prev,
                            margin_top: parseFloat(e.target.value) || 0,
                          }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded border border-gray-300 py-1 px-2"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500">Bottom</span>
                      <input
                        type="number"
                        value={layout.margin_bottom}
                        onChange={(e) =>
                          setLayout((prev) => ({
                            ...prev,
                            margin_bottom: parseFloat(e.target.value) || 0,
                          }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded border border-gray-300 py-1 px-2"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500">Left</span>
                      <input
                        type="number"
                        value={layout.margin_left}
                        onChange={(e) =>
                          setLayout((prev) => ({
                            ...prev,
                            margin_left: parseFloat(e.target.value) || 0,
                          }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded border border-gray-300 py-1 px-2"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500">Right</span>
                      <input
                        type="number"
                        value={layout.margin_right}
                        onChange={(e) =>
                          setLayout((prev) => ({
                            ...prev,
                            margin_right: parseFloat(e.target.value) || 0,
                          }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded border border-gray-300 py-1 px-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Font */}
                <div className="pt-2 border-t border-gray-200">
                  <label className="block font-semibold text-gray-800 mb-1">
                    Primary Font
                  </label>
                  <select
                    value={layout.primary_font}
                    onChange={(e) =>
                      setLayout((prev) => ({ ...prev, primary_font: e.target.value }))
                    }
                    disabled={!isOwner}
                    className="w-full rounded border border-gray-300 py-1.5 px-2 text-xs"
                  >
                    <option value="Helvetica">Helvetica (Standard Sans-Serif)</option>
                    <option value="Times-Roman">Times-Roman (Serif)</option>
                    <option value="Courier">Courier (Monospace)</option>
                  </select>
                </div>

                {/* Template Classification */}
                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <label className="block font-semibold text-gray-800">
                    Template Settings
                  </label>
                  <div>
                    <span className="text-[10px] text-gray-500">Billing Mode Target</span>
                    <select
                      value={templateType}
                      onChange={(e) => setTemplateType(e.target.value as any)}
                      disabled={!isOwner}
                      className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                    >
                      <option value="CONSOLIDATED">Consolidated (Multi-Trip Bill)</option>
                      <option value="INDIVIDUAL">Individual (Single Trip Bill)</option>
                      <option value="MULTI_PAGE">Multi-Page Document</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500">Template Status</span>
                    <select
                      value={templateStatus}
                      onChange={(e) => setTemplateStatus(e.target.value as any)}
                      disabled={!isOwner}
                      className="w-full rounded border border-gray-300 py-1 px-2 text-xs"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active (Available for billing)</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* DYNAMIC FIELD DIRECTORY MODAL */}
      <DynamicFieldPickerModal
        isOpen={isDynamicFieldModalOpen}
        onClose={() => setIsDynamicFieldModalOpen(false)}
        onSelectField={handleSelectDynamicField}
        contextType={dynamicFieldContext}
      />

      {/* REFERENCE IMPORT MODAL */}
      <TemplateImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(imported) => {
          setIsImportModalOpen(false);
          setTemplateName(imported.name || 'Imported Bill Template');
          setTemplateType(imported.template_type || 'CONSOLIDATED');
          if (imported.layout_json) {
            setLayout((prev) => ({ ...prev, ...imported.layout_json }));
          }
          setComponents(imported.components || []);
          setDynamicFields(imported.dynamic_fields || []);
          if (imported.components?.length > 0) {
            setSelectedKey(imported.components[0].component_key);
          }
          setHeuristicWarningBanner(
            `Draft layout imported (Confidence: ${imported.confidence}). Layout was extracted heuristically without OCR. This draft layout is fully editable and will NEVER be used as a static background image.`
          );
        }}
      />

      {/* TEMPLATE PREVIEW MODAL */}
      <TemplatePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        templateId={id}
        templateType={templateType}
        layoutJson={layout}
        components={components}
        dynamicFields={dynamicFields}
      />

      {/* ASSET MANAGER DRAWER / MODAL */}
      {isAssetDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-semibold text-gray-900">
                  Template Assets Manager
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAssetDrawerOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* In create mode warning */}
            {!id && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                Please save this template first to upload template-specific assets to the storage
                server.
              </div>
            )}

            {/* Upload asset form */}
            {id && isOwner && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <span className="text-xs font-semibold text-gray-700">Upload New Asset</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500">Asset Category</span>
                    <select
                      value={assetUploadType}
                      onChange={(e) => setAssetUploadType(e.target.value as any)}
                      className="w-full rounded border border-gray-300 py-1 px-2"
                    >
                      <option value="LOGO">Logo</option>
                      <option value="SIGNATURE">Signature</option>
                      <option value="STAMP">Stamp</option>
                      <option value="IMAGE">Generic Image</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500">File (PNG / JPEG &lt; 5MB)</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setAssetUploadFile(e.target.files[0]);
                        }
                      }}
                      className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700"
                    />
                  </div>
                </div>

                {assetUploadError && (
                  <div className="text-xs text-red-600">{assetUploadError}</div>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={handleUploadAsset}
                  disabled={!assetUploadFile}
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  Upload Asset
                </Button>
              </div>
            )}

            {/* Asset List */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              <span className="text-xs font-semibold text-gray-700">
                Existing Assets ({assets.length})
              </span>
              {assets.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No assets uploaded yet.</p>
              ) : (
                assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-2 border border-gray-200 rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-gray-800">{asset.file_name}</span>
                      <div className="text-[10px] text-gray-400 font-mono">
                        Type: {asset.asset_type} • Key: {asset.storage_key.split('/').pop()}
                      </div>
                    </div>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete Asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-200">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAssetDrawerOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
