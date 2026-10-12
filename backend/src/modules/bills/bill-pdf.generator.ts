export function generateBillPdfBuffer(bill: any): Buffer {
  const sanitize = (text: any) => {
    if (text === null || text === undefined) return '';
    return String(text).replace(/[\\()]/g, '');
  };

  const lines: string[] = [];
  lines.push('BT');
  lines.push('/F2 16 Tf');
  lines.push('50 750 Td');
  lines.push(`(${sanitize('SHRI SANWARIYA ROAD LINES')}) Tj`);
  lines.push('/F1 10 Tf');
  lines.push('0 -18 Td');
  lines.push(`(${sanitize('Transport Contractors & Fleet Owners')}) Tj`);
  lines.push('0 -22 Td');

  // Horizontal separator rule
  lines.push('ET');
  lines.push('50 700 m 562 700 l S');
  lines.push('BT');

  lines.push('/F2 11 Tf');
  lines.push('50 680 Td');
  lines.push(`(BILL NO: ${sanitize(bill.bill_number)}) Tj`);
  lines.push('250 0 Td');
  lines.push(`(DATE: ${sanitize(bill.bill_date)}) Tj`);
  lines.push('150 0 Td');
  lines.push(`(STATUS: ${sanitize(bill.bill_status)}) Tj`);

  lines.push('/F1 10 Tf');
  lines.push('-400 -20 Td');
  lines.push(`(Billing Mode: ${sanitize(bill.billing_mode)}) Tj`);
  lines.push('250 0 Td');
  lines.push(`(Financial Year: ${sanitize(bill.financial_year?.code || bill.financial_year_code || '')}) Tj`);

  // Party Section
  lines.push('-250 -30 Td');
  lines.push('/F2 11 Tf');
  lines.push(`(BILLED TO:) Tj`);
  lines.push('/F1 10 Tf');
  lines.push('0 -16 Td');
  lines.push(`(Party Name: ${sanitize(bill.party?.name || bill.party_name || '')}) Tj`);
  lines.push('0 -14 Td');
  lines.push(`(Mobile: ${sanitize(bill.party?.primary_mobile || '')}    GSTIN: ${sanitize(bill.party?.gstin || 'N/A')}) Tj`);
  if (bill.party?.address || bill.party?.city) {
    lines.push('0 -14 Td');
    lines.push(`(Address: ${sanitize(bill.party?.address || '')}, ${sanitize(bill.party?.city || '')} ${sanitize(bill.party?.state || '')}) Tj`);
  }

  // Items Table Header
  lines.push('0 -30 Td');
  lines.push('/F2 10 Tf');
  lines.push(`(#   Description                                      Trip No      Vehicle       Amount) Tj`);
  lines.push('ET');
  lines.push('50 525 m 562 525 l S');
  lines.push('BT');

  let currentY = 510;
  lines.push(`50 ${currentY} Td`);
  lines.push('/F1 9 Tf');

  const items = Array.isArray(bill.items) ? bill.items : [];
  for (const item of items) {
    const seq = String(item.sequence_no || 1).padEnd(4, ' ');
    const desc = sanitize((item.description || 'Freight Charges').slice(0, 40)).padEnd(45, ' ');
    const tripNo = sanitize(item.trip_number || '-').padEnd(12, ' ');
    const veh = sanitize(item.vehicle_number || '-').padEnd(12, ' ');
    const amt = 'INR ' + Number(item.line_amount || 0).toFixed(2);
    lines.push(`(${seq} ${desc} ${tripNo} ${veh} ${amt}) Tj`);
    lines.push('0 -16 Td');
    currentY -= 16;
  }

  // Summary / Totals
  lines.push('ET');
  lines.push(`50 ${currentY + 10} m 562 ${currentY + 10} l S`);
  lines.push('BT');

  lines.push(`350 ${currentY - 10} Td`);
  lines.push('/F2 11 Tf');
  lines.push(`(Total Amount:   INR ${Number(bill.total_amount || 0).toFixed(2)}) Tj`);
  lines.push('0 -16 Td');
  lines.push('/F1 10 Tf');
  lines.push(`(Paid Amount:    INR ${Number(bill.paid_amount || 0).toFixed(2)}) Tj`);
  lines.push('0 -16 Td');
  lines.push('/F2 10 Tf');
  lines.push(`(Balance Amount: INR ${Number(bill.balance_amount || 0).toFixed(2)}) Tj`);

  // Footer
  lines.push('-300 -40 Td');
  lines.push('/F1 8 Tf');
  lines.push(`(This is a computer-generated billing document issued by Shri Sanwariya Road Lines.) Tj`);
  lines.push('ET');

  const streamContent = lines.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  // Assemble PDF Objects
  const header = '%PDF-1.4\n';

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n';
  const obj4 = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  const obj6 = '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n';

  const offsets: number[] = [0];
  let currentOffset = Buffer.byteLength(header, 'utf-8');

  offsets.push(currentOffset);
  currentOffset += Buffer.byteLength(obj1, 'utf-8');

  offsets.push(currentOffset);
  currentOffset += Buffer.byteLength(obj2, 'utf-8');

  offsets.push(currentOffset);
  currentOffset += Buffer.byteLength(obj3, 'utf-8');

  offsets.push(currentOffset);
  currentOffset += Buffer.byteLength(obj4, 'utf-8');

  offsets.push(currentOffset);
  currentOffset += Buffer.byteLength(obj5, 'utf-8');

  offsets.push(currentOffset);
  currentOffset += Buffer.byteLength(obj6, 'utf-8');

  const startXref = currentOffset;

  let xref = 'xref\n0 7\n0000000000 65535 f \n';
  for (let i = 1; i <= 6; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const fullPdf = header + obj1 + obj2 + obj3 + obj4 + obj5 + obj6 + xref + trailer;
  return Buffer.from(fullPdf, 'utf-8');
}
