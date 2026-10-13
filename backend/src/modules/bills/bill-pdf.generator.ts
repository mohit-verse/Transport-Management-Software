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
  };
  party_name?: string;
  template_snapshot?: {
    template?: { name?: string; template_type?: string };
    layout?: Record<string, any>;
  };
  items: Array<{
    sequence_no: number;
    description: string;
    trip_number?: string;
    vehicle_number?: string;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    line_amount: number | string;
  }>;
}

export function generateBillPdfBuffer(bill: BillPdfData): Buffer {
  const sanitize = (text: any) => {
    if (text === null || text === undefined) return '';
    return String(text).replace(/[\\()]/g, '').replace(/[^\x20-\x7E]/g, ' ');
  };

  const formatCurrency = (amount: any) => {
    const num = Number(amount || 0);
    return 'INR ' + num.toFixed(2);
  };

  const allItems = Array.isArray(bill.items) ? bill.items : [];

  // Determine pagination
  // Page 1 header takes ~240pt. Usable Y: 530 down to 140 (if 1 page) or 60 (if multi-page).
  // Each item takes 16pt.
  // Single-page limit: ~22 items.
  // Multi-page: Page 1 gets 20 items. Continuation pages get up to 32 items.
  const pagesItems: Array<typeof allItems> = [];
  if (allItems.length <= 20) {
    pagesItems.push(allItems);
  } else {
    pagesItems.push(allItems.slice(0, 20));
    let remaining = allItems.slice(20);
    while (remaining.length > 0) {
      // If remaining items + totals block fit in 30 items
      const chunkSize = 30;
      pagesItems.push(remaining.slice(0, chunkSize));
      remaining = remaining.slice(chunkSize);
    }
  }

  // If last page has more than 24 items, totals block might need its own page or extra space
  const totalPages = pagesItems.length;

  const pageStreams: string[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageNum = pageIdx + 1;
    const itemsOnThisPage = pagesItems[pageIdx];
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;

    const lines: string[] = [];

    if (isFirstPage) {
      // Full SRL Header
      lines.push('BT');
      lines.push('/F2 16 Tf');
      lines.push('50 750 Td');
      lines.push(`(${sanitize('SHRI SANWARIYA ROAD LINES')}) Tj`);
      lines.push('/F1 9 Tf');
      lines.push('0 -16 Td');
      lines.push(`(${sanitize('Fleet Owners & Transport Contractors')}) Tj`);
      lines.push('ET');

      // Top divider
      lines.push('50 720 m 562 720 l S');

      // Bill metadata box
      lines.push('BT');
      lines.push('/F2 10 Tf');
      lines.push('50 705 Td');
      lines.push(`(BILL NO: ${sanitize(bill.bill_number)}) Tj`);
      lines.push('220 0 Td');
      lines.push(`(DATE: ${sanitize(bill.bill_date)}) Tj`);
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

      // Party / Customer Section
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

      // Divider before table
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
        lines.push(`(${formatCurrency(item.line_amount)}) Tj`);
        lines.push('ET');
        currentY -= 15;
      }

      // If last page, render totals
      if (isLastPage) {
        renderTotals(lines, currentY, bill, formatCurrency, sanitize);
      }
    } else {
      // Continuation Page Header
      lines.push('BT');
      lines.push('/F2 11 Tf');
      lines.push('50 750 Td');
      lines.push(`(${sanitize('SHRI SANWARIYA ROAD LINES')} - Bill No: ${sanitize(bill.bill_number)} [Page ${pageNum} of ${totalPages}]) Tj`);
      lines.push('ET');

      lines.push('50 740 m 562 740 l S');

      // Table Header
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
        lines.push(`(${formatCurrency(item.line_amount)}) Tj`);
        lines.push('ET');
        currentY -= 15;
      }

      if (isLastPage) {
        renderTotals(lines, currentY, bill, formatCurrency, sanitize);
      }
    }

    // Page Footer on every page
    lines.push('BT');
    lines.push('/F1 8 Tf');
    lines.push(`270 30 Td`);
    lines.push(`(Page ${pageNum} of ${totalPages}) Tj`);
    lines.push('ET');

    pageStreams.push(lines.join('\n'));
  }

  return assemblePdf(pageStreams);
}

function renderTotals(
  lines: string[],
  currentY: number,
  bill: BillPdfData,
  formatCurrency: (amount: any) => string,
  sanitize: (text: any) => string
) {
  const lineY = Math.max(currentY, 130);
  lines.push(`50 ${lineY} m 562 ${lineY} l S`);

  lines.push('BT');
  lines.push(`360 ${lineY - 18} Td`);
  lines.push('/F2 10 Tf');
  lines.push(`(Total Amount:   ${formatCurrency(bill.total_amount)}) Tj`);
  lines.push('0 -15 Td');
  lines.push('/F1 9 Tf');
  lines.push(`(Paid Amount:    ${formatCurrency(bill.paid_amount || 0)}) Tj`);
  lines.push('0 -15 Td');
  lines.push('/F2 9 Tf');
  lines.push(`(Balance Amount: ${formatCurrency(bill.balance_amount || 0)}) Tj`);

  // Footer Disclaimer
  lines.push('-310 -25 Td');
  lines.push('/F1 8 Tf');
  lines.push(`(${sanitize('This is a computer-generated billing document issued by Shri Sanwariya Road Lines.')}) Tj`);
  lines.push('ET');
}

function assemblePdf(pageStreams: string[]): Buffer {
  const pageCount = pageStreams.length;
  const header = '%PDF-1.4\n';

  // Object indices:
  // 1: Catalog
  // 2: Pages
  // Page 1: 3, Contents 1: 4
  // Page 2: 5, Contents 2: 6
  // ...
  // Page N: 2N+1, Contents N: 2N+2
  // Font F1: 2N+3
  // Font F2: 2N+4

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

    const pageObj = `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentsObjId} 0 R /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R >> >> >>\nendobj\n`;
    const contentsObj = `${contentsObjId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

    pageObjects.push(pageObj);
    pageObjects.push(contentsObj);
  }

  const font1Obj = `${font1Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const font2Obj = `${font2Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  // Measure byte offsets
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
