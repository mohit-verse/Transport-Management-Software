import { generateBillPdfBuffer } from '../src/modules/bills/bill-pdf.generator';
import { previewTemplateSchema } from '../src/modules/bill-templates/bill-templates.schema';

describe('Bill Designer & PDF Generator Pure Unit Tests', () => {
  it('validates previewTemplateSchema with empty template_id and draft dynamic fields without UUID', () => {
    const draftInput = {
      body: {
        template_id: '',
        template_type: 'CONSOLIDATED',
        layout_json: { orientation: 'LANDSCAPE', page_width: 595.28, page_height: 841.89 },
        components: [
          {
            component_type: 'TEXT',
            component_key: 'company_header',
            position_x: 36,
            position_y: 50,
            width: 300,
            height: 40,
            content_json: { text: 'SHRI SANWARIYA ROAD LINES' }
          }
        ],
        dynamic_fields: [
          {
            field_definition_id: '',
            binding_path: 'party.name',
            display_label: 'Party Name'
          }
        ]
      }
    };

    const parsed = previewTemplateSchema.parse(draftInput);
    expect(parsed.body.template_id).toBeUndefined();
    expect(parsed.body.dynamic_fields[0].field_definition_id).toBeUndefined();
    expect(parsed.body.dynamic_fields[0].binding_path).toBe('party.name');
  });

  it('correctly sets MediaBox dimensions for LANDSCAPE orientation (width > height)', () => {
    const landscapeBill = {
      id: 'test-landscape',
      bill_number: 'SRL/26-27/LS-01',
      bill_date: '2026-04-15',
      bill_status: 'PREVIEW',
      billing_mode: 'CONSOLIDATED',
      total_amount: 50000,
      template_snapshot: {
        layout: {
          orientation: 'LANDSCAPE',
          page_width: 595.28,
          page_height: 841.89
        },
        components: [
          {
            component_type: 'HEADER',
            component_key: 'hdr',
            position_x: 40,
            position_y: 20,
            content_json: { title: 'LANDSCAPE SSRL BILL' }
          }
        ]
      },
      items: [
        {
          sequence_no: 1,
          description: 'Freight Mundra to Jaipur',
          line_amount: 50000
        }
      ]
    };

    const buf = generateBillPdfBuffer(landscapeBill as any);
    const pdfStr = buf.toString('utf-8');

    // Confirm MediaBox has width 841.89 and height 595.28
    expect(pdfStr).toContain('/MediaBox [0 0 841.89 595.28]');
    expect(pdfStr).toContain('LANDSCAPE SSRL BILL');
  });

  it('renders BORDER components as rectangles rather than single lines', () => {
    const borderBill = {
      id: 'test-border',
      bill_number: 'SRL/26-27/BDR-01',
      bill_date: '2026-04-15',
      bill_status: 'PREVIEW',
      billing_mode: 'INDIVIDUAL',
      total_amount: 15000,
      template_snapshot: {
        layout: { orientation: 'PORTRAIT', page_width: 595.28, page_height: 841.89 },
        components: [
          {
            component_type: 'BORDER',
            component_key: 'terms_box',
            position_x: 40,
            position_y: 600,
            width: 500,
            height: 80
          }
        ]
      },
      items: []
    };

    const buf = generateBillPdfBuffer(borderBill as any);
    const pdfStr = buf.toString('utf-8');

    // re S defines a rectangle in PDF operators
    expect(pdfStr).toMatch(/40\s+\d+(\.\d+)?\s+500\s+80\s+re\s+S/);
  });

  it('renders styled placeholder box for unuploaded assets in PREVIEW mode without crashing', () => {
    const previewBillWithMissingAsset = {
      id: 'preview-draft',
      bill_number: 'SRL/26-27/PREV-01',
      bill_date: '2026-04-15',
      bill_status: 'PREVIEW',
      billing_mode: 'CONSOLIDATED',
      total_amount: 25000,
      template_snapshot: {
        layout: {},
        components: [
          {
            component_type: 'IMAGE',
            component_key: 'draft_logo',
            position_x: 40,
            position_y: 30,
            width: 150,
            height: 60,
            content_json: {
              label: 'Unuploaded Company Logo',
              required: true,
              storage_key: 'templates/assets/not_yet_uploaded.png'
            }
          }
        ],
        assets: []
      },
      items: []
    };

    expect(() => {
      const buf = generateBillPdfBuffer(previewBillWithMissingAsset as any);
      expect(Buffer.isBuffer(buf)).toBe(true);
      const str = buf.toString('utf-8');
      expect(str).toContain('Unuploaded Company Logo');
    }).not.toThrow();
  });

  it('still enforces required assets on finalized non-preview bills (bill_status != PREVIEW)', () => {
    const finalizedBillMissingAsset = {
      id: 'final-bill',
      bill_number: 'SRL/26-27/001',
      bill_date: '2026-04-15',
      bill_status: 'GENERATED',
      billing_mode: 'CONSOLIDATED',
      total_amount: 25000,
      template_snapshot: {
        layout: {},
        components: [
          {
            component_type: 'IMAGE',
            component_key: 'company_logo',
            position_x: 40,
            position_y: 30,
            width: 150,
            height: 60,
            content_json: {
              label: 'Company Official Logo',
              required: true,
              storage_key: 'templates/assets/missing.png'
            }
          }
        ],
        assets: []
      },
      items: []
    };

    expect(() => {
      generateBillPdfBuffer(finalizedBillMissingAsset as any);
    }).toThrow(/Required bill template asset "Company Official Logo" \(IMAGE\) is missing from template snapshot/);
  });
});
