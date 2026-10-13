import { resolveTextTemplate, formatCurrency, formatDate, amountToWordsINR, DynamicFieldContext } from '../bill-templates/dynamic-fields.resolver';

export interface BillPdfData {
  id: string;
  bill_number: string;
  bill_date: string;
  bill_status: string;
  billing_mode: string;
  total_amount: number | string;
  paid_amount?: number | string;
  balance_amount?: number | string;
  version_number?: number;
  version_label?: string;
  version_status?: string;
  financial_year?: { code?: string; start_date?: string; end_date?: string };
  financial_year_code?: string;
  party?: {
    name?: string;
    primary_mobile?: string;
    gstin?: string;
    full_address?: string;
    address?: string;
    city?: string;
    state?: string;
    pin_code?: string;
    billing_address?: string;
  };
  party_name?: string;
  template_snapshot?: {
    template?: { name?: string; template_type?: string };
    layout?: Record<string, any>;
    components?: Array<{
      component_type: string;
      component_key: string;
      position_x?: number | null;
      position_y?: number | null;
      width?: number | null;
      height?: number | null;
      style_json?: Record<string, any>;
      content_json?: Record<string, any>;
    }>;
    assets?: Array<{
      asset_type: string;
      file_name: string;
      storage_key: string;
      mime_type?: string;
    }>;
    dynamic_field_definitions?: Array<any>;
  };
  items: Array<{
    sequence_no: number;
    description: string;
    trip_number?: string;
    vehicle_number?: string;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    line_amount: number | string;
    trip_id?: string;
  }>;
}

export function generateBillPdfBuffer(bill: BillPdfData): Buffer {
  const sanitize = (text: any): string => {
    if (text === null || text === undefined) return '';
    return String(text).replace(/[\\()]/g, '').replace(/[^\x20-\x7E]/g, ' ');
  };

  // Build resolution context
  const resolutionContext: DynamicFieldContext = {
    party: bill.party || { name: bill.party_name },
    bill: {
      bill_number: bill.bill_number,
      bill_date: bill.bill_date,
      billing_mode: bill.billing_mode,
      bill_status: bill.bill_status,
      financial_year_code: bill.financial_year?.code || bill.financial_year_code,
      total_amount: bill.total_amount,
      paid_amount: bill.paid_amount || 0,
      balance_amount: bill.balance_amount || bill.total_amount
    },
    billing: {
      bill_number: bill.bill_number,
      bill_date: bill.bill_date,
      billing_mode: bill.billing_mode,
      bill_status: bill.bill_status,
      financial_year_code: bill.financial_year?.code || bill.financial_year_code,
      total_amount: bill.total_amount,
      paid_amount: bill.paid_amount || 0,
      balance_amount: bill.balance_amount || bill.total_amount
    },
    payment: {
      total_paid: bill.paid_amount || 0,
      outstanding_balance: bill.balance_amount || bill.total_amount,
      payment_status: Number(bill.balance_amount || 0) === 0 ? 'PAID' : 'PENDING'
    },
    calculated: {
      total_freight: bill.total_amount,
      balance_payable: bill.balance_amount || bill.total_amount,
      total_amount: bill.total_amount,
      amount_in_words: amountToWordsINR(bill.total_amount)
    },
    items: bill.items || []
  };

  const components = bill.template_snapshot?.components;
  const layout = bill.template_snapshot?.layout || {};

  // If structured components exist, use template-driven renderer
  if (Array.isArray(components) && components.length > 0) {
    return renderStructuredTemplate(bill, components, layout, resolutionContext, sanitize);
  }

  // Fallback canonical layout
  return renderCanonicalLayout(bill, resolutionContext, sanitize);
}

/**
 * Structured Template Renderer
 */
function renderStructuredTemplate(
  bill: BillPdfData,
  components: Array<any>,
  layout: Record<string, any>,
  context: DynamicFieldContext,
  sanitize: (t: any) => string
): Buffer {
  const pageWidth = layout.page_width || 595.28; // Default A4
  const pageHeight = layout.page_height || 841.89;
  const marginLeft = layout.margin_left || 40;
  const marginRight = layout.margin_right || 40;
  const marginTop = layout.margin_top || 40;
  const marginBottom = layout.margin_bottom || 40;
  const printableWidth = pageWidth - marginLeft - marginRight;

  const toPdfY = (y: number | null | undefined, defaultY: number): number => {
    if (y === null || y === undefined) return defaultY;
    // If coordinate was specified top-down (y <= pageHeight / 2), convert to bottom-up
    if (y <= pageHeight / 2) {
      return pageHeight - marginTop - y;
    }
    return y;
  };

  // Group components by type
  const headerComponents = components.filter((c) => c.component_type === 'HEADER');
  const footerComponents = components.filter((c) => c.component_type === 'FOOTER');
  const tableComponents = components.filter((c) => c.component_type === 'TABLE');
  const otherComponents = components.filter((c) => !['HEADER', 'FOOTER', 'TABLE'].includes(c.component_type));

  const items = Array.isArray(bill.items) ? bill.items : [];

  // Determine row pagination: up to 24 rows per page
  const itemsPerPage = 22;
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const pageStreams: string[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageNum = pageIdx + 1;
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;
    const itemsOnPage = items.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);

    const lines: string[] = [];

    // 1. Render Headers
    if (isFirstPage && headerComponents.length > 0) {
      for (const h of headerComponents) {
        const title = resolveTextTemplate(h.content_json?.title || h.content_json?.text || 'SHRI SANWARIYA ROAD LINES', context);
        const subtitle = resolveTextTemplate(h.content_json?.subtitle || '', context);
        const y = toPdfY(h.position_y, pageHeight - marginTop - 20);

        lines.push('BT');
        lines.push('/F2 16 Tf');
        lines.push(`${marginLeft} ${y} Td`);
        lines.push(`(${sanitize(title)}) Tj`);
        if (subtitle) {
          lines.push('/F1 9 Tf');
          lines.push('0 -16 Td');
          lines.push(`(${sanitize(subtitle)}) Tj`);
        }
        lines.push('ET');

        // Divider
        lines.push(`${marginLeft} ${y - 25} m ${pageWidth - marginRight} ${y - 25} l S`);
      }
    } else if (!isFirstPage) {
      // Continuation header
      lines.push('BT');
      lines.push('/F2 10 Tf');
      lines.push(`${marginLeft} ${pageHeight - marginTop - 15} Td`);
      lines.push(`(${sanitize('SHRI SANWARIYA ROAD LINES')} - Bill No: ${sanitize(bill.bill_number)} (Continuation) [Page ${pageNum} of ${totalPages}]) Tj`);
      lines.push('ET');
      lines.push(`${marginLeft} ${pageHeight - marginTop - 25} m ${pageWidth - marginRight} ${pageHeight - marginTop - 25} l S`);
    }

    // 2. Render Other Components on first page (Text, Lines, Images)
    if (isFirstPage) {
      for (const comp of otherComponents) {
        const posX = comp.position_x !== null && comp.position_x !== undefined ? comp.position_x : marginLeft;
        const posY = toPdfY(comp.position_y, 650);

        if (comp.component_type === 'TEXT') {
          const fontSize = comp.style_json?.font_size || 9;
          const isBold = comp.style_json?.bold || false;
          let text = '';
          const rawTemplate = comp.content_json?.template_text || comp.content_json?.text || '';
          if (rawTemplate) {
            text = resolveTextTemplate(rawTemplate, context);
          } else if (comp.content_json?.label && comp.content_json?.binding) {
            const val = resolveTextTemplate(comp.content_json.binding, context);
            text = `${comp.content_json.label}: ${val}`;
          } else if (comp.content_json?.label) {
            text = comp.content_json.label;
          }

          if (text) {
            const textLines = text.split('\n');
            lines.push('BT');
            lines.push(`/${isBold ? 'F2' : 'F1'} ${fontSize} Tf`);
            lines.push(`${posX} ${posY} Td`);
            lines.push(`(${sanitize(textLines[0])}) Tj`);
            for (let li = 1; li < textLines.length; li++) {
              lines.push(`0 -${fontSize + 4} Td`);
              lines.push(`(${sanitize(textLines[li])}) Tj`);
            }
            lines.push('ET');
          }
        } else if (comp.component_type === 'LINE' || comp.component_type === 'BORDER') {
          const lineWidth = comp.width || printableWidth;
          lines.push(`${posX} ${posY} m ${posX + lineWidth} ${posY} l S`);
        } else if (['IMAGE', 'LOGO', 'SIGNATURE', 'STAMP'].includes(comp.component_type)) {
          const w = comp.width || 120;
          const h = comp.height || 40;
          const label = comp.content_json?.label || comp.component_key || comp.component_type;

          // Check if this asset component is marked required
          const isRequired = comp.content_json?.required === true || comp.content_json?.is_required === true;
          if (isRequired) {
            const snapshotAssets = bill.template_snapshot?.assets || [];
            const matchingAsset = snapshotAssets.find((a: any) =>
              (comp.content_json?.storage_key && a.storage_key === comp.content_json.storage_key) ||
              (comp.content_json?.asset_id && a.id === comp.content_json.asset_id) ||
              (comp.content_json?.asset_type && a.asset_type === comp.content_json.asset_type) ||
              (a.asset_type === comp.component_type)
            );
            if (!matchingAsset || !matchingAsset.storage_key) {
              throw new Error(`Required bill template asset "${label}" (${comp.component_type}) is missing from template snapshot`);
            }
          }

          // Render framed placeholder box
          lines.push(`${posX} ${posY - h} ${w} ${h} re S`);
          lines.push('BT');
          lines.push('/F1 8 Tf');
          lines.push(`${posX + 6} ${posY - h + (h / 2) - 4} Td`);
          lines.push(`([${sanitize(label)}]) Tj`);
          lines.push('ET');
        }
      }
    }

    // 3. Render Table
    let tableStartY = isFirstPage ? 520 : pageHeight - marginTop - 45;
    if (tableComponents.length > 0 && tableComponents[0].position_y !== null && tableComponents[0].position_y !== undefined) {
      if (isFirstPage) {
        tableStartY = toPdfY(tableComponents[0].position_y, 520);
      }
    }

    // Table Header
    lines.push('BT');
    lines.push('/F2 9 Tf');
    lines.push(`${marginLeft} ${tableStartY} Td`);
    lines.push(`(#) Tj`);
    lines.push('25 0 Td');
    lines.push(`(Description) Tj`);
    lines.push('190 0 Td');
    lines.push(`(Trip No) Tj`);
    lines.push('80 0 Td');
    lines.push(`(Vehicle) Tj`);
    lines.push('85 0 Td');
    lines.push(`(Amount) Tj`);
    lines.push('ET');

    lines.push(`${marginLeft} ${tableStartY - 6} m ${pageWidth - marginRight} ${tableStartY - 6} l S`);

    let currentY = tableStartY - 20;
    for (const item of itemsOnPage) {
      lines.push('BT');
      lines.push('/F1 9 Tf');
      lines.push(`${marginLeft} ${currentY} Td`);
      lines.push(`(${String(item.sequence_no || 1)}) Tj`);
      lines.push('25 0 Td');
      lines.push(`(${sanitize((item.description || 'Freight Charges').slice(0, 36))}) Tj`);
      lines.push('190 0 Td');
      lines.push(`(${sanitize(item.trip_number || '-')}) Tj`);
      lines.push('80 0 Td');
      lines.push(`(${sanitize(item.vehicle_number || '-')}) Tj`);
      lines.push('85 0 Td');
      lines.push(`(${sanitize(formatCurrency(item.line_amount))}) Tj`);
      lines.push('ET');
      currentY -= 15;
    }

    // 4. Render Totals on last page
    if (isLastPage) {
      const totalsY = Math.max(currentY - 10, marginBottom + 60);
      lines.push(`${marginLeft} ${totalsY} m ${pageWidth - marginRight} ${totalsY} l S`);

      lines.push('BT');
      lines.push(`${pageWidth - marginRight - 190} ${totalsY - 16} Td`);
      lines.push('/F2 10 Tf');
      lines.push(`(Total Amount:   ${sanitize(formatCurrency(bill.total_amount))}) Tj`);
      lines.push('0 -14 Td');
      lines.push('/F1 9 Tf');
      lines.push(`(Paid Amount:    ${sanitize(formatCurrency(bill.paid_amount || 0))}) Tj`);
      lines.push('0 -14 Td');
      lines.push('/F2 9 Tf');
      lines.push(`(Balance Amount: ${sanitize(formatCurrency(bill.balance_amount || 0))}) Tj`);
      lines.push('ET');

      // Custom footer components if any
      if (footerComponents.length > 0) {
        for (const foot of footerComponents) {
          const footText = resolveTextTemplate(foot.content_json?.footer_text || foot.content_json?.text || '', context);
          if (footText) {
            lines.push('BT');
            lines.push('/F1 8 Tf');
            lines.push(`${marginLeft} ${marginBottom + 30} Td`);
            lines.push(`(${sanitize(footText)}) Tj`);
            lines.push('ET');
          }
        }
      } else {
        lines.push('BT');
        lines.push('/F1 8 Tf');
        lines.push(`${marginLeft} ${marginBottom + 30} Td`);
        lines.push(`(${sanitize('This is a computer-generated billing document issued by Shri Sanwariya Road Lines.')}) Tj`);
        lines.push('ET');
      }
    }

    // 5. Page number footer on every page
    lines.push('BT');
    lines.push('/F1 8 Tf');
    lines.push(`${pageWidth / 2 - 25} ${marginBottom + 10} Td`);
    lines.push(`(Page ${pageNum} of ${totalPages}) Tj`);
    lines.push('ET');

    pageStreams.push(lines.join('\n'));
  }

  return assemblePdf(pageStreams, pageWidth, pageHeight);
}

/**
 * Fallback Canonical SSRL Layout
 */
function renderCanonicalLayout(
  bill: BillPdfData,
  context: DynamicFieldContext,
  sanitize: (t: any) => string
): Buffer {
  const allItems = Array.isArray(bill.items) ? bill.items : [];
  const pagesItems: Array<typeof allItems> = [];
  if (allItems.length <= 20) {
    pagesItems.push(allItems);
  } else {
    pagesItems.push(allItems.slice(0, 20));
    let remaining = allItems.slice(20);
    while (remaining.length > 0) {
      const chunkSize = 30;
      pagesItems.push(remaining.slice(0, chunkSize));
      remaining = remaining.slice(chunkSize);
    }
  }

  const totalPages = pagesItems.length;
  const pageStreams: string[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageNum = pageIdx + 1;
    const itemsOnThisPage = pagesItems[pageIdx];
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;

    const lines: string[] = [];

    if (isFirstPage) {
      lines.push('BT');
      lines.push('/F2 16 Tf');
      lines.push('50 750 Td');
      lines.push(`(${sanitize('SHRI SANWARIYA ROAD LINES')}) Tj`);
      lines.push('/F1 9 Tf');
      lines.push('0 -16 Td');
      lines.push(`(${sanitize('Fleet Owners & Transport Contractors')}) Tj`);
      lines.push('ET');

      lines.push('50 720 m 562 720 l S');

      lines.push('BT');
      lines.push('/F2 10 Tf');
      lines.push('50 705 Td');
      lines.push(`(BILL NO: ${sanitize(bill.bill_number)}) Tj`);
      lines.push('220 0 Td');
      lines.push(`(DATE: ${sanitize(formatDate(bill.bill_date))}) Tj`);
      lines.push('160 0 Td');
      const statusLabel = bill.version_status ? `${bill.bill_status} (${bill.version_status})` : bill.bill_status;
      lines.push(`(STATUS: ${sanitize(statusLabel)}) Tj`);

      lines.push('/F1 9 Tf');
      lines.push('-380 -18 Td');
      lines.push(`(Billing Mode: ${sanitize(bill.billing_mode)}) Tj`);
      lines.push('220 0 Td');
      const fyCode = bill.financial_year?.code || bill.financial_year_code || 'N/A';
      lines.push(`(Financial Year: ${sanitize(fyCode)}) Tj`);
      lines.push('160 0 Td');
      const vLabel = bill.version_label || (bill.version_number ? `Version ${bill.version_number}` : 'Version 1');
      lines.push(`(Document: ${sanitize(vLabel)}) Tj`);

      // Billed To Party
      lines.push('-380 -26 Td');
      lines.push('/F2 10 Tf');
      lines.push(`(BILLED TO:) Tj`);
      lines.push('/F1 9 Tf');
      lines.push('0 -14 Td');
      const partyName = bill.party?.name || bill.party_name || 'N/A';
      lines.push(`(Party Name: ${sanitize(partyName)}) Tj`);
      lines.push('0 -13 Td');
      const mobile = bill.party?.primary_mobile || 'N/A';
      const gstin = bill.party?.gstin || 'N/A';
      lines.push(`(Mobile: ${sanitize(mobile)}    GSTIN: ${sanitize(gstin)}) Tj`);

      const addr = bill.party?.full_address || bill.party?.address || '';
      const cityState = [bill.party?.city, bill.party?.state, bill.party?.pin_code].filter(Boolean).join(', ');
      const fullAddr = [addr, cityState].filter(Boolean).join(' - ');
      if (fullAddr) {
        lines.push('0 -13 Td');
        lines.push(`(Address: ${sanitize(fullAddr.slice(0, 85))}) Tj`);
      }

      if (bill.template_snapshot?.template?.name) {
        lines.push('0 -13 Td');
        lines.push(`(Template: ${sanitize(bill.template_snapshot.template.name)}) Tj`);
      }
      lines.push('ET');

      lines.push('50 560 m 562 560 l S');

      // Table Header
      lines.push('BT');
      lines.push('/F2 9 Tf');
      lines.push('50 545 Td');
      lines.push(`(#) Tj`);
      lines.push('25 0 Td');
      lines.push(`(Description) Tj`);
      lines.push('200 0 Td');
      lines.push(`(Trip No) Tj`);
      lines.push('75 0 Td');
      lines.push(`(Vehicle) Tj`);
      lines.push('80 0 Td');
      lines.push(`(Amount) Tj`);
      lines.push('ET');

      lines.push('50 535 m 562 535 l S');

      let currentY = 520;
      for (const item of itemsOnThisPage) {
        lines.push('BT');
        lines.push('/F1 9 Tf');
        lines.push(`50 ${currentY} Td`);
        lines.push(`(${String(item.sequence_no || 1)}) Tj`);
        lines.push('25 0 Td');
        lines.push(`(${sanitize((item.description || 'Freight Charges').slice(0, 38))}) Tj`);
        lines.push('200 0 Td');
        lines.push(`(${sanitize(item.trip_number || '-')}) Tj`);
        lines.push('75 0 Td');
        lines.push(`(${sanitize(item.vehicle_number || '-')}) Tj`);
        lines.push('80 0 Td');
        lines.push(`(${sanitize(formatCurrency(item.line_amount))}) Tj`);
        lines.push('ET');
        currentY -= 15;
      }

      if (isLastPage) {
        renderCanonicalTotals(lines, currentY, bill, sanitize);
      }
    } else {
      // Continuation Header
      lines.push('BT');
      lines.push('/F2 11 Tf');
      lines.push('50 750 Td');
      lines.push(`(${sanitize('SHRI SANWARIYA ROAD LINES')} - Bill No: ${sanitize(bill.bill_number)} [Page ${pageNum} of ${totalPages}]) Tj`);
      lines.push('ET');

      lines.push('50 740 m 562 740 l S');

      lines.push('BT');
      lines.push('/F2 9 Tf');
      lines.push('50 725 Td');
      lines.push(`(#) Tj`);
      lines.push('25 0 Td');
      lines.push(`(Description) Tj`);
      lines.push('200 0 Td');
      lines.push(`(Trip No) Tj`);
      lines.push('75 0 Td');
      lines.push(`(Vehicle) Tj`);
      lines.push('80 0 Td');
      lines.push(`(Amount) Tj`);
      lines.push('ET');

      lines.push('50 715 m 562 715 l S');

      let currentY = 700;
      for (const item of itemsOnThisPage) {
        lines.push('BT');
        lines.push('/F1 9 Tf');
        lines.push(`50 ${currentY} Td`);
        lines.push(`(${String(item.sequence_no || 1)}) Tj`);
        lines.push('25 0 Td');
        lines.push(`(${sanitize((item.description || 'Freight Charges').slice(0, 38))}) Tj`);
        lines.push('200 0 Td');
        lines.push(`(${sanitize(item.trip_number || '-')}) Tj`);
        lines.push('75 0 Td');
        lines.push(`(${sanitize(item.vehicle_number || '-')}) Tj`);
        lines.push('80 0 Td');
        lines.push(`(${sanitize(formatCurrency(item.line_amount))}) Tj`);
        lines.push('ET');
        currentY -= 15;
      }

      if (isLastPage) {
        renderCanonicalTotals(lines, currentY, bill, sanitize);
      }
    }

    lines.push('BT');
    lines.push('/F1 8 Tf');
    lines.push(`270 30 Td`);
    lines.push(`(Page ${pageNum} of ${totalPages}) Tj`);
    lines.push('ET');

    pageStreams.push(lines.join('\n'));
  }

  return assemblePdf(pageStreams, 612, 792);
}

function renderCanonicalTotals(
  lines: string[],
  currentY: number,
  bill: BillPdfData,
  sanitize: (t: any) => string
): void {
  const lineY = Math.max(currentY, 130);
  lines.push(`50 ${lineY} m 562 ${lineY} l S`);

  lines.push('BT');
  lines.push(`360 ${lineY - 18} Td`);
  lines.push('/F2 10 Tf');
  lines.push(`(Total Amount:   ${sanitize(formatCurrency(bill.total_amount))}) Tj`);
  lines.push('0 -15 Td');
  lines.push('/F1 9 Tf');
  lines.push(`(Paid Amount:    ${sanitize(formatCurrency(bill.paid_amount || 0))}) Tj`);
  lines.push('0 -15 Td');
  lines.push('/F2 9 Tf');
  lines.push(`(Balance Amount: ${sanitize(formatCurrency(bill.balance_amount || 0))}) Tj`);

  lines.push('-310 -25 Td');
  lines.push('/F1 8 Tf');
  lines.push(`(${sanitize('This is a computer-generated billing document issued by Shri Sanwariya Road Lines.')}) Tj`);
  lines.push('ET');
}

/**
 * Assembles pure PDF-1.4 file
 */
function assemblePdf(pageStreams: string[], pageWidth: number = 612, pageHeight: number = 792): Buffer {
  const pageCount = pageStreams.length;
  const header = '%PDF-1.4\n';

  const font1Id = 2 * pageCount + 3;
  const font2Id = 2 * pageCount + 4;
  const totalObjects = 2 * pageCount + 4;

  const kidsRefs: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    kidsRefs.push(`${2 * i + 1} 0 R`);
  }

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [ ${kidsRefs.join(' ')} ] /Count ${pageCount} >>\nendobj\n`;

  const pageObjects: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const pageObjId = 2 * i + 1;
    const contentsObjId = 2 * i + 2;
    const streamContent = pageStreams[i - 1];
    const streamLength = Buffer.byteLength(streamContent, 'utf-8');

    const pageObj = `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents ${contentsObjId} 0 R /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R >> >> >>\nendobj\n`;
    const contentsObj = `${contentsObjId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

    pageObjects.push(pageObj);
    pageObjects.push(contentsObj);
  }

  const font1Obj = `${font1Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const font2Obj = `${font2Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  const objectsMap: Array<{ id: number; content: string }> = [
    { id: 1, content: obj1 },
    { id: 2, content: obj2 }
  ];

  for (let i = 0; i < pageObjects.length; i++) {
    objectsMap.push({ id: 3 + i, content: pageObjects[i] });
  }
  objectsMap.push({ id: font1Id, content: font1Obj });
  objectsMap.push({ id: font2Id, content: font2Obj });

  const offsets: number[] = [0];
  let currentOffset = Buffer.byteLength(header, 'utf-8');

  for (const obj of objectsMap) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj.content, 'utf-8');
  }

  const startXref = currentOffset;

  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjects; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  const trailer = `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  let fullPdfContent = header;
  for (const obj of objectsMap) {
    fullPdfContent += obj.content;
  }
  fullPdfContent += xref + trailer;

  return Buffer.from(fullPdfContent, 'utf-8');
}
