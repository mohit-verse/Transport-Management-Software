import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageContainer } from '../components/PageContainer';
import { AmountDisplay } from '../components/AmountDisplay';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { useAuthStore } from '../store/authStore';
import {
  getFinancialSummary,
  getPnlReport,
  getIncomingReport,
  getOutgoingReport,
  getPaymentModesReport,
  getCreditsReport,
  getTdsReport,
  getBillReconciliationReport,
  getFinancialYears,
  getParties,
  type ReportQueryParams,
  type IncomingReportItem,
  type OutgoingReportItem,
  type TdsReportItem,
  type BillReconciliationItem,
  type PaymentModeReportItem,
} from '../services/api';
import { exportToCsv } from '../utils/csvExport';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  CreditCard,
  FileCheck,
  Receipt,
  Download,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Filter,
  RefreshCw,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export type ReportTab =
  | 'overview'
  | 'pnl'
  | 'incoming'
  | 'outgoing'
  | 'modes'
  | 'credits'
  | 'tds'
  | 'bill-recon';

export const Reports: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isCa = user?.role === 'CA';

  // Active Tab
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  // Filter Mode: 'FY' | 'CUSTOM'
  const [filterMode, setFilterMode] = useState<'FY' | 'CUSTOM'>('FY');
  const [selectedFyId, setSelectedFyId] = useState<string>('');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');

  // Pagination states for paginated views
  const [incomingPage, setIncomingPage] = useState<number>(1);
  const [outgoingPage, setOutgoingPage] = useState<number>(1);
  const [tdsPage, setTdsPage] = useState<number>(1);
  const [billReconPage, setBillReconPage] = useState<number>(1);
  const pageSize = 20;

  // Fetch Financial Years for period selector
  const { data: fyData } = useQuery({
    queryKey: ['financial-years'],
    queryFn: getFinancialYears,
  });
  const financialYears = useMemo(() => fyData?.data || [], [fyData]);

  // Default to active Financial Year
  const activeFy = useMemo(() => {
    if (financialYears.length === 0) return null;
    return financialYears.find((fy) => fy.is_active) || financialYears[0];
  }, [financialYears]);

  // Current effective FY
  const currentFy = useMemo(() => {
    if (!selectedFyId) return activeFy;
    return financialYears.find((fy) => fy.id === selectedFyId) || activeFy;
  }, [selectedFyId, activeFy, financialYears]);

  // Fetch Parties for party filter
  const { data: partiesData } = useQuery({
    queryKey: ['parties-for-reports'],
    queryFn: getParties,
  });
  const parties = useMemo(() => partiesData?.data || [], [partiesData]);

  // Unambiguous Date Resolution
  // If filterMode === 'FY', fromDate and toDate strictly track currentFy's start and end date.
  // If filterMode === 'CUSTOM', customFromDate and customToDate are used.
  const effectiveDateRange = useMemo(() => {
    if (filterMode === 'FY' && currentFy) {
      const start = currentFy.start_date.split('T')[0];
      const end = currentFy.end_date.split('T')[0];
      return { fromDate: start, toDate: end, label: `FY ${currentFy.code} (${start} to ${end})` };
    }
    return {
      fromDate: customFromDate || undefined,
      toDate: customToDate || undefined,
      label:
        customFromDate || customToDate
          ? `Custom Range (${customFromDate || 'Beginning'} to ${customToDate || 'Present'})`
          : 'All Dates (Unrestricted)',
    };
  }, [filterMode, currentFy, customFromDate, customToDate]);

  // Base query params for report APIs
  const baseQueryParams: ReportQueryParams = useMemo(() => {
    const q: ReportQueryParams = {};
    if (effectiveDateRange.fromDate) q.fromDate = effectiveDateRange.fromDate;
    if (effectiveDateRange.toDate) q.toDate = effectiveDateRange.toDate;
    if (selectedPartyId) q.partyId = selectedPartyId;
    return q;
  }, [effectiveDateRange, selectedPartyId]);

  // Reset filters to active financial year
  const handleResetFilters = () => {
    setFilterMode('FY');
    if (activeFy) setSelectedFyId(activeFy.id);
    setCustomFromDate('');
    setCustomToDate('');
    setSelectedPartyId('');
    setIncomingPage(1);
    setOutgoingPage(1);
    setTdsPage(1);
    setBillReconPage(1);
  };

  // Switch to Custom filter mode
  const handleSwitchToCustom = () => {
    setFilterMode('CUSTOM');
    if (currentFy && !customFromDate && !customToDate) {
      setCustomFromDate(currentFy.start_date.split('T')[0]);
      setCustomToDate(currentFy.end_date.split('T')[0]);
    }
  };

  // Switch to FY filter mode
  const handleSwitchToFy = () => {
    setFilterMode('FY');
    if (!selectedFyId && activeFy) {
      setSelectedFyId(activeFy.id);
    }
  };

  // ==========================================
  // Report Queries
  // ==========================================

  // 1. Financial Summary
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['report-financial-summary', baseQueryParams],
    queryFn: () => getFinancialSummary(baseQueryParams),
    enabled: activeTab === 'overview',
  });

  // 2. Profit & Loss
  const {
    data: pnlData,
    isLoading: isPnlLoading,
    isError: isPnlError,
    refetch: refetchPnl,
  } = useQuery({
    queryKey: ['report-pnl', baseQueryParams],
    queryFn: () => getPnlReport(baseQueryParams),
    enabled: activeTab === 'pnl',
  });

  // 3. Incoming Payments
  const {
    data: incomingData,
    isLoading: isIncomingLoading,
    isError: isIncomingError,
    refetch: refetchIncoming,
  } = useQuery({
    queryKey: ['report-incoming', baseQueryParams, incomingPage],
    queryFn: () => getIncomingReport({ ...baseQueryParams, page: incomingPage, pageSize }),
    enabled: activeTab === 'incoming',
  });

  // 4. Outgoing Payments
  const {
    data: outgoingData,
    isLoading: isOutgoingLoading,
    isError: isOutgoingError,
    refetch: refetchOutgoing,
  } = useQuery({
    queryKey: ['report-outgoing', baseQueryParams, outgoingPage],
    queryFn: () => getOutgoingReport({ ...baseQueryParams, page: outgoingPage, pageSize }),
    enabled: activeTab === 'outgoing',
  });

  // 5. Payment Modes
  const {
    data: modesData,
    isLoading: isModesLoading,
    isError: isModesError,
    refetch: refetchModes,
  } = useQuery({
    queryKey: ['report-modes', baseQueryParams],
    queryFn: () => getPaymentModesReport(baseQueryParams),
    enabled: activeTab === 'modes' || activeTab === 'overview',
  });

  // 6. Party Credits
  const {
    data: creditsData,
    isLoading: isCreditsLoading,
    isError: isCreditsError,
    refetch: refetchCredits,
  } = useQuery({
    queryKey: ['report-credits', selectedPartyId],
    queryFn: () => getCreditsReport(selectedPartyId ? { partyId: selectedPartyId } : undefined),
    enabled: activeTab === 'credits',
  });

  // 7. TDS Report
  const {
    data: tdsData,
    isLoading: isTdsLoading,
    isError: isTdsError,
    refetch: refetchTds,
  } = useQuery({
    queryKey: ['report-tds', baseQueryParams, tdsPage],
    queryFn: () => getTdsReport({ ...baseQueryParams, page: tdsPage, pageSize }),
    enabled: activeTab === 'tds',
  });

  // 8. Bill Reconciliation
  const {
    data: billReconData,
    isLoading: isBillReconLoading,
    isError: isBillReconError,
    refetch: refetchBillRecon,
  } = useQuery({
    queryKey: ['report-bill-recon', baseQueryParams, billReconPage],
    queryFn: () => getBillReconciliationReport({ ...baseQueryParams, page: billReconPage, pageSize }),
    enabled: activeTab === 'bill-recon',
  });

  // ==========================================
  // Export Handlers (Accurate Scope & Reconciled Totals)
  // ==========================================

  // Helper to fetch 100% of matching records across multiple pages without risk of silent truncation
  async function fetchAllReportPages<T>(
    fetchPage: (page: number, pageSize: number) => Promise<{
      data: {
        items: T[];
        total?: number;
        count: number;
        totalBilled?: number;
        totalAllocated?: number;
        totalOutstanding?: number;
      };
    }>,
    batchSize = 100
  ): Promise<{
    items: T[];
    count: number;
    total?: number;
    totalBilled?: number;
    totalAllocated?: number;
    totalOutstanding?: number;
  }> {
    let page = 1;
    const allItems: T[] = [];
    let reportedCount = 0;
    let reportedTotal: number | undefined;
    let reportedBilled: number | undefined;
    let reportedAllocated: number | undefined;
    let reportedOutstanding: number | undefined;

    while (true) {
      const res = await fetchPage(page, batchSize);
      reportedCount = res.data.count;
      reportedTotal = res.data.total;
      reportedBilled = res.data.totalBilled;
      reportedAllocated = res.data.totalAllocated;
      reportedOutstanding = res.data.totalOutstanding;

      const items = res.data.items || [];
      allItems.push(...items);

      if (reportedCount > 0 && allItems.length >= reportedCount) {
        break;
      }
      if (items.length === 0 || (reportedCount === 0 && items.length < batchSize)) {
        break;
      }
      page++;
    }

    return {
      items: allItems,
      count: reportedCount,
      total: reportedTotal,
      totalBilled: reportedBilled,
      totalAllocated: reportedAllocated,
      totalOutstanding: reportedOutstanding,
    };
  }

  // Incoming Payments CSV Export
  const [isExportingIncomingAll, setIsExportingIncomingAll] = useState(false);

  const handleExportIncomingPage = () => {
    if (!incomingData?.data?.items) return;
    const items = incomingData.data.items;
    const pageTotal = items.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);

    exportToCsv({
      filename: `incoming-payments-page-${incomingPage}`,
      metadata: [
        { label: 'Report', value: 'Incoming Payments' },
        { label: 'Scope', value: `Current Page (Page ${incomingPage})` },
        { label: 'Reporting Period', value: effectiveDateRange.label },
        { label: 'Exported At', value: new Date().toLocaleString('en-IN') },
      ],
      headers: ['Payment ID', 'Payment Date', 'Party / Entity', 'Category', 'Mode', 'Amount (INR)', 'Status'],
      rows: items.map((item) => [
        item.payment_id,
        item.payment_date ? item.payment_date.split('T')[0] : '',
        item.party_name || item.other_category_name || 'N/A',
        item.category,
        item.payment_mode,
        item.amount,
        item.payment_status,
      ]),
      summaryRows: [
        ['Page Total', '', '', '', '', pageTotal.toFixed(2), `${items.length} items on page`],
        ['Reconciled Filtered Total (Backend)', '', '', '', '', incomingData.data.total.toFixed(2), `${incomingData.data.count} total records`],
      ],
    });
  };

  const handleExportIncomingAll = async () => {
    try {
      setIsExportingIncomingAll(true);
      // Fetch 100% of records matching active filter across all pages
      const fullRes = await fetchAllReportPages((p, ps) =>
        getIncomingReport({ ...baseQueryParams, page: p, pageSize: ps })
      );
      const items = fullRes.items || [];
      const calculatedSum = items.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);

      exportToCsv({
        filename: `incoming-payments-full-filtered`,
        metadata: [
          { label: 'Report', value: 'Incoming Payments' },
          { label: 'Scope', value: 'Full Filtered Report (All Matching Records)' },
          { label: 'Reporting Period', value: effectiveDateRange.label },
          { label: 'Total Records Exported', value: items.length },
          { label: 'Exported At', value: new Date().toLocaleString('en-IN') },
        ],
        headers: ['Payment ID', 'Payment Date', 'Party / Entity', 'Category', 'Mode', 'Amount (INR)', 'Status'],
        rows: items.map((item) => [
          item.payment_id,
          item.payment_date ? item.payment_date.split('T')[0] : '',
          item.party_name || item.other_category_name || 'N/A',
          item.category,
          item.payment_mode,
          item.amount,
          item.payment_status,
        ]),
        summaryRows: [
          ['Grand Total (Backend Authoritative)', '', '', '', '', (fullRes.total || 0).toFixed(2), `${fullRes.count} records`],
          ['Sum of Exported Rows', '', '', '', '', calculatedSum.toFixed(2), 'Reconciled'],
        ],
      });
    } finally {
      setIsExportingIncomingAll(false);
    }
  };

  // Outgoing Payments CSV Export
  const [isExportingOutgoingAll, setIsExportingOutgoingAll] = useState(false);

  const handleExportOutgoingPage = () => {
    if (!outgoingData?.data?.items) return;
    const items = outgoingData.data.items;
    const pageTotal = items.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);

    exportToCsv({
      filename: `outgoing-payments-page-${outgoingPage}`,
      metadata: [
        { label: 'Report', value: 'Outgoing Payments' },
        { label: 'Scope', value: `Current Page (Page ${outgoingPage})` },
        { label: 'Reporting Period', value: effectiveDateRange.label },
        { label: 'Exported At', value: new Date().toLocaleString('en-IN') },
      ],
      headers: ['Payment ID', 'Payment Date', 'Vehicle Owner / Entity', 'Category', 'Mode', 'Amount (INR)', 'Status'],
      rows: items.map((item) => [
        item.payment_id,
        item.payment_date ? item.payment_date.split('T')[0] : '',
        item.vehicle_owner_name || item.other_category_name || 'N/A',
        item.category,
        item.payment_mode,
        item.amount,
        item.payment_status,
      ]),
      summaryRows: [
        ['Page Total', '', '', '', '', pageTotal.toFixed(2), `${items.length} items on page`],
        ['Reconciled Filtered Total (Backend)', '', '', '', '', outgoingData.data.total.toFixed(2), `${outgoingData.data.count} total records`],
      ],
    });
  };

  const handleExportOutgoingAll = async () => {
    try {
      setIsExportingOutgoingAll(true);
      const fullRes = await fetchAllReportPages((p, ps) =>
        getOutgoingReport({ ...baseQueryParams, page: p, pageSize: ps })
      );
      const items = fullRes.items || [];
      const calculatedSum = items.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);

      exportToCsv({
        filename: `outgoing-payments-full-filtered`,
        metadata: [
          { label: 'Report', value: 'Outgoing Payments' },
          { label: 'Scope', value: 'Full Filtered Report (All Matching Records)' },
          { label: 'Reporting Period', value: effectiveDateRange.label },
          { label: 'Total Records Exported', value: items.length },
          { label: 'Exported At', value: new Date().toLocaleString('en-IN') },
        ],
        headers: ['Payment ID', 'Payment Date', 'Vehicle Owner / Entity', 'Category', 'Mode', 'Amount (INR)', 'Status'],
        rows: items.map((item) => [
          item.payment_id,
          item.payment_date ? item.payment_date.split('T')[0] : '',
          item.vehicle_owner_name || item.other_category_name || 'N/A',
          item.category,
          item.payment_mode,
          item.amount,
          item.payment_status,
        ]),
        summaryRows: [
          ['Grand Total (Backend Authoritative)', '', '', '', '', (fullRes.total || 0).toFixed(2), `${fullRes.count} records`],
          ['Sum of Exported Rows', '', '', '', '', calculatedSum.toFixed(2), 'Reconciled'],
        ],
      });
    } finally {
      setIsExportingOutgoingAll(false);
    }
  };

  // Payment Modes CSV Export
  const handleExportPaymentModes = () => {
    if (!modesData?.data) return;
    const items = modesData.data;

    exportToCsv({
      filename: `payment-modes-summary`,
      metadata: [
        { label: 'Report', value: 'Payment Modes Summary' },
        { label: 'Reporting Period', value: effectiveDateRange.label },
        { label: 'Exported At', value: new Date().toLocaleString('en-IN') },
      ],
      headers: ['Payment Mode', 'Incoming Receipts (INR)', 'Outgoing Expenses (INR)', 'Net Movement (INR)', 'Transaction Count'],
      rows: items.map((m) => {
        const inc = parseFloat(String(m.incoming_amount)) || 0;
        const out = parseFloat(String(m.outgoing_amount)) || 0;
        return [m.payment_mode, inc.toFixed(2), out.toFixed(2), (inc - out).toFixed(2), m.payment_count];
      }),
    });
  };

  // TDS Report CSV Export
  const [isExportingTdsAll, setIsExportingTdsAll] = useState(false);

  const handleExportTdsPage = () => {
    if (!tdsData?.data?.items) return;
    const items = tdsData.data.items;
    const pageTotal = items.reduce((sum, item) => sum + (parseFloat(String(item.tds_amount)) || 0), 0);

    exportToCsv({
      filename: `tds-report-page-${tdsPage}`,
      metadata: [
        { label: 'Report', value: 'TDS Deductions Report' },
        { label: 'Scope', value: `Current Page (Page ${tdsPage})` },
        { label: 'Reporting Period', value: effectiveDateRange.label },
        { label: 'Exported At', value: new Date().toLocaleString('en-IN') },
      ],
      headers: ['Trip Number', 'Trip Date', 'Party / Company', 'TDS Amount (INR)'],
      rows: items.map((item) => [
        item.trip_number,
        item.trip_date ? item.trip_date.split('T')[0] : '',
        item.party_name,
        item.tds_amount,
      ]),
      summaryRows: [
        ['Page Total', '', '', pageTotal.toFixed(2)],
        ['Grand Reconciled Total (Backend)', '', '', (tdsData.data.total || 0).toFixed(2)],
      ],
    });
  };

  const handleExportTdsAll = async () => {
    try {
      setIsExportingTdsAll(true);
      const fullRes = await fetchAllReportPages((p, ps) =>
        getTdsReport({ ...baseQueryParams, page: p, pageSize: ps })
      );
      const items = fullRes.items || [];
      const calculatedSum = items.reduce((sum, item) => sum + (parseFloat(String(item.tds_amount)) || 0), 0);

      exportToCsv({
        filename: `tds-report-full`,
        metadata: [
          { label: 'Report', value: 'TDS Deductions Report' },
          { label: 'Scope', value: 'Full Filtered Report (All Qualifying Trips)' },
          { label: 'Reporting Period', value: effectiveDateRange.label },
          { label: 'Total Records Exported', value: items.length },
          { label: 'Exported At', value: new Date().toLocaleString('en-IN') },
        ],
        headers: ['Trip Number', 'Trip Date', 'Party / Company', 'TDS Amount (INR)'],
        rows: items.map((item) => [
          item.trip_number,
          item.trip_date ? item.trip_date.split('T')[0] : '',
          item.party_name,
          item.tds_amount,
        ]),
        summaryRows: [
          ['Grand Total (Backend Authoritative)', '', '', (fullRes.total || 0).toFixed(2)],
          ['Sum of Exported Rows', '', '', calculatedSum.toFixed(2)],
        ],
      });
    } finally {
      setIsExportingTdsAll(false);
    }
  };

  // Bill Reconciliation CSV Export
  const [isExportingBillReconAll, setIsExportingBillReconAll] = useState(false);

  const handleExportBillReconPage = () => {
    if (!billReconData?.data?.items) return;
    const items = billReconData.data.items;
    const pageTotalBilled = items.reduce((sum, item) => sum + (parseFloat(String(item.total_amount)) || 0), 0);
    const pageTotalAllocated = items.reduce((sum, item) => sum + (parseFloat(String(item.allocated_amount)) || 0), 0);
    const pageTotalBalance = items.reduce((sum, item) => sum + (parseFloat(String(item.balance_amount)) || 0), 0);

    exportToCsv({
      filename: `bill-reconciliation-page-${billReconPage}`,
      metadata: [
        { label: 'Report', value: 'Bill Payment Reconciliation' },
        { label: 'Scope', value: `Current Page (Page ${billReconPage})` },
        { label: 'Reporting Period', value: effectiveDateRange.label },
        { label: 'Exported At', value: new Date().toLocaleString('en-IN') },
      ],
      headers: ['Bill Number', 'Bill Date', 'Party / Company', 'Status', 'Total Bill Amount (INR)', 'Allocated Paid (INR)', 'Outstanding Balance (INR)'],
      rows: items.map((b) => [
        b.bill_number,
        b.bill_date ? b.bill_date.split('T')[0] : '',
        b.party_name,
        b.bill_status,
        b.total_amount,
        b.allocated_amount,
        b.balance_amount,
      ]),
      summaryRows: [
        ['Page Total', '', '', '', pageTotalBilled.toFixed(2), pageTotalAllocated.toFixed(2), pageTotalBalance.toFixed(2)],
        ['Backend Authoritative Filtered Totals', '', '', '', (billReconData.data.totalBilled || 0).toFixed(2), (billReconData.data.totalAllocated || 0).toFixed(2), (billReconData.data.totalOutstanding || 0).toFixed(2)],
      ],
    });
  };

  const handleExportBillReconAll = async () => {
    try {
      setIsExportingBillReconAll(true);
      const fullRes = await fetchAllReportPages((p, ps) =>
        getBillReconciliationReport({ ...baseQueryParams, page: p, pageSize: ps })
      );
      const items = fullRes.items || [];
      const sumBilled = items.reduce((sum, item) => sum + (parseFloat(String(item.total_amount)) || 0), 0);
      const sumAllocated = items.reduce((sum, item) => sum + (parseFloat(String(item.allocated_amount)) || 0), 0);
      const sumBalance = items.reduce((sum, item) => sum + (parseFloat(String(item.balance_amount)) || 0), 0);

      exportToCsv({
        filename: `bill-reconciliation-full`,
        metadata: [
          { label: 'Report', value: 'Bill Payment Reconciliation' },
          { label: 'Scope', value: 'Full Filtered Report (All Matching Bills)' },
          { label: 'Reporting Period', value: effectiveDateRange.label },
          { label: 'Total Records Exported', value: items.length },
          { label: 'Exported At', value: new Date().toLocaleString('en-IN') },
        ],
        headers: ['Bill Number', 'Bill Date', 'Party / Company', 'Status', 'Total Bill Amount (INR)', 'Allocated Paid (INR)', 'Outstanding Balance (INR)'],
        rows: items.map((b) => [
          b.bill_number,
          b.bill_date ? b.bill_date.split('T')[0] : '',
          b.party_name,
          b.bill_status,
          b.total_amount,
          b.allocated_amount,
          b.balance_amount,
        ]),
        summaryRows: [
          ['Grand Total (Backend Authoritative)', '', '', '', (fullRes.totalBilled || 0).toFixed(2), (fullRes.totalAllocated || 0).toFixed(2), (fullRes.totalOutstanding || 0).toFixed(2)],
          ['Sum of Exported Rows', '', '', '', sumBilled.toFixed(2), sumAllocated.toFixed(2), sumBalance.toFixed(2)],
        ],
      });
    } finally {
      setIsExportingBillReconAll(false);
    }
  };

  // Tab definitions
  const tabs: Array<{ id: ReportTab; label: string; icon: React.ElementType }> = [
    { id: 'overview', label: 'Financial Overview', icon: Scale },
    { id: 'pnl', label: 'Profit & Loss', icon: TrendingUp },
    { id: 'incoming', label: 'Incoming Payments', icon: TrendingUp },
    { id: 'outgoing', label: 'Outgoing Payments', icon: TrendingDown },
    { id: 'modes', label: 'Payment Modes', icon: CreditCard },
    { id: 'credits', label: 'Party Credits', icon: FileCheck },
    { id: 'tds', label: 'TDS Report', icon: Receipt },
    { id: 'bill-recon', label: 'Bill Reconciliation', icon: Receipt },
  ];

  return (
    <PageContainer
      title={isCa ? 'CA & Financial Reports Workspace' : 'Financial Reports'}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 text-xs py-1.5 px-3"
            title="Reset to Active Financial Year"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Filters
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* CA Role Notice Banner */}
        {isCa && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-indigo-900">
              <span className="font-semibold">Chartered Accountant Workspace (Read-Only):</span> You have read-only access to view authoritative financial reports, payment histories, TDS records, and bill reconciliation data. All numbers derive directly from actual money movement in the Payment Module. Formal statutory accounting and tax filings remain the independent responsibility of the CA.
            </div>
          </div>
        )}

        {/* Global Filter Bar with Unambiguous FY vs Custom Dates Interaction */}
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Reporting Period & Filters
              </span>
            </div>

            {/* Mode Toggle: Financial Year vs Custom Dates */}
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={handleSwitchToFy}
                className={`px-3 py-1 text-xs font-medium rounded-l-md border transition-colors ${
                  filterMode === 'FY'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Financial Year
              </button>
              <button
                type="button"
                onClick={handleSwitchToCustom}
                className={`px-3 py-1 text-xs font-medium rounded-r-md border transition-colors ${
                  filterMode === 'CUSTOM'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Custom Date Range
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Condition 1: Financial Year Selector */}
            {filterMode === 'FY' ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Financial Year
                </label>
                <select
                  value={selectedFyId || (activeFy ? activeFy.id : '')}
                  onChange={(e) => {
                    setSelectedFyId(e.target.value);
                    setIncomingPage(1);
                    setOutgoingPage(1);
                    setTdsPage(1);
                    setBillReconPage(1);
                  }}
                  className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-1.5 px-3 border"
                >
                  {financialYears.map((fy) => (
                    <option key={fy.id} value={fy.id}>
                      FY {fy.code} {fy.is_active ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* From Date (Read-only bound to FY in FY mode; interactive in Custom mode) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                From Date {filterMode === 'FY' && <span className="text-gray-400 font-normal">(Locked to FY)</span>}
              </label>
              <input
                type="date"
                disabled={filterMode === 'FY'}
                value={effectiveDateRange.fromDate || ''}
                onChange={(e) => {
                  setCustomFromDate(e.target.value);
                  setIncomingPage(1);
                  setOutgoingPage(1);
                  setTdsPage(1);
                  setBillReconPage(1);
                }}
                className={`w-full text-sm border rounded-md shadow-sm py-1.5 px-3 ${
                  filterMode === 'FY'
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
                    : 'bg-white text-gray-900 border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                To Date {filterMode === 'FY' && <span className="text-gray-400 font-normal">(Locked to FY)</span>}
              </label>
              <input
                type="date"
                disabled={filterMode === 'FY'}
                value={effectiveDateRange.toDate || ''}
                onChange={(e) => {
                  setCustomToDate(e.target.value);
                  setIncomingPage(1);
                  setOutgoingPage(1);
                  setTdsPage(1);
                  setBillReconPage(1);
                }}
                className={`w-full text-sm border rounded-md shadow-sm py-1.5 px-3 ${
                  filterMode === 'FY'
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
                    : 'bg-white text-gray-900 border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
            </div>

            {/* Party / Company Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Party / Company Filter
              </label>
              <select
                value={selectedPartyId}
                onChange={(e) => {
                  setSelectedPartyId(e.target.value);
                  setIncomingPage(1);
                  setOutgoingPage(1);
                  setTdsPage(1);
                  setBillReconPage(1);
                }}
                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-1.5 px-3 border"
              >
                <option value="">All Parties & Entities</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.party_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Period Display Banner */}
          <div className="flex items-center justify-between text-xs pt-2 text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Active Scope:</span>
              {activeTab === 'credits' ? (
                <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Cumulative All-Time Reserve (Date Filters Do Not Apply)
                </span>
              ) : (
                <span className="font-semibold text-gray-800">{effectiveDateRange.label}</span>
              )}
              {selectedPartyId && (
                <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                  Party: {parties.find((p) => p.id === selectedPartyId)?.name || 'Filtered'}
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-400">
              * Active payment transactions only (reversed payments strictly excluded)
            </span>
          </div>
        </div>

        {/* Tab Navigation (Responsive Bar) */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex space-x-6 min-w-max pb-px" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ==================================================================== */}
        {/* VIEW 1: FINANCIAL OVERVIEW                                            */}
        {/* ==================================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {isSummaryLoading ? (
              <div className="p-12 text-center text-gray-500">Loading Financial Overview...</div>
            ) : isSummaryError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>Failed to load Financial Summary from backend.</span>
                </div>
                <Button variant="secondary" onClick={() => refetchSummary()} className="text-xs">
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* Primary 3 KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Total Incoming */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                        Total Incoming Payments
                      </p>
                      <p className="text-2xl font-bold text-gray-900 font-mono">
                        <AmountDisplay amount={summaryData?.data?.totalIncoming || 0} />
                      </p>
                      <p className="text-xs text-gray-500 mt-2">Active business receipts</p>
                    </div>
                    <div className="p-3 bg-green-50 text-green-600 rounded-full">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Total Outgoing */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                        Total Outgoing Payments
                      </p>
                      <p className="text-2xl font-bold text-gray-900 font-mono">
                        <AmountDisplay amount={summaryData?.data?.totalOutgoing || 0} />
                      </p>
                      <p className="text-xs text-gray-500 mt-2">Active business disbursements</p>
                    </div>
                    <div className="p-3 bg-red-50 text-red-600 rounded-full">
                      <TrendingDown className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Net Business P&L */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                        Net Business P&L
                      </p>
                      <p
                        className={`text-2xl font-bold font-mono ${
                          (summaryData?.data?.netPnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        <AmountDisplay amount={summaryData?.data?.netPnl || 0} />
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Incoming − Outgoing (authoritative)
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                      <Scale className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* Formula Transparency Card */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 flex items-start gap-3">
                  <Scale className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-gray-800">
                      Authoritative Payment-Derived Formula:
                    </span>{' '}
                    Net P&L is calculated strictly as Active Incoming Payments minus Active Outgoing Payments. Reversed payments and unallocated operational invoices are excluded from active cash position totals.
                  </div>
                </div>

                {/* Quick Breakdown Snippet: Payment Modes */}
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">
                      Payment Modes Snapshot
                    </h3>
                    <button
                      onClick={() => setActiveTab('modes')}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                    >
                      View Details <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {modesData?.data && modesData.data.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {modesData.data.map((m: PaymentModeReportItem) => (
                        <div key={m.payment_mode} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <span className="text-xs font-semibold text-gray-700 block mb-2">
                            {m.payment_mode.replace('_', ' ')}
                          </span>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Incoming:</span>
                              <span className="font-mono text-green-700 font-medium">
                                <AmountDisplay amount={m.incoming_amount} />
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Outgoing:</span>
                              <span className="font-mono text-red-700 font-medium">
                                <AmountDisplay amount={m.outgoing_amount} />
                              </span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-gray-200">
                              <span className="text-gray-500">Count:</span>
                              <span className="font-mono text-gray-800">{m.payment_count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No payment activity recorded for this period.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: PROFIT & LOSS                                                */}
        {/* ==================================================================== */}
        {activeTab === 'pnl' && (
          <div className="space-y-6">
            {isPnlLoading ? (
              <div className="p-12 text-center text-gray-500">Loading Profit & Loss Statement...</div>
            ) : isPnlError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
                <span>Failed to load Profit & Loss report.</span>
                <Button variant="secondary" onClick={() => refetchPnl()} className="text-xs">
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* Summary Strip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <span className="text-xs text-green-700 uppercase font-semibold block">Total Revenue (Incoming)</span>
                    <span className="text-xl font-bold font-mono text-green-900">
                      <AmountDisplay amount={pnlData?.data?.totalIncoming || 0} />
                    </span>
                  </div>
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <span className="text-xs text-red-700 uppercase font-semibold block">Total Expense (Outgoing)</span>
                    <span className="text-xl font-bold font-mono text-red-900">
                      <AmountDisplay amount={pnlData?.data?.totalOutgoing || 0} />
                    </span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <span className="text-xs text-blue-700 uppercase font-semibold block">Net Business P&L</span>
                    <span className={`text-xl font-bold font-mono ${(pnlData?.data?.netPnl || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      <AmountDisplay amount={pnlData?.data?.netPnl || 0} />
                    </span>
                  </div>
                </div>

                {/* Categorized Breakdown Tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Incoming by Category */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                      <h4 className="font-semibold text-sm text-gray-900">Incoming Receipts by Category</h4>
                      <span className="text-xs text-gray-500 font-mono">
                        <AmountDisplay amount={pnlData?.data?.totalIncoming || 0} />
                      </span>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Category</th>
                          <th className="px-4 py-2 text-right font-medium">Amount (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pnlData?.data?.incomingByCategory && pnlData.data.incomingByCategory.length > 0 ? (
                          pnlData.data.incomingByCategory.map((c) => (
                            <tr key={c.category} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-gray-900 font-medium">{c.category.replace(/_/g, ' ')}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-medium text-green-700">
                                <AmountDisplay amount={c.total} />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="px-4 py-6 text-center text-xs text-gray-400">
                              No incoming payments in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Outgoing by Category */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                      <h4 className="font-semibold text-sm text-gray-900">Outgoing Payments by Category</h4>
                      <span className="text-xs text-gray-500 font-mono">
                        <AmountDisplay amount={pnlData?.data?.totalOutgoing || 0} />
                      </span>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Category</th>
                          <th className="px-4 py-2 text-right font-medium">Amount (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pnlData?.data?.outgoingByCategory && pnlData.data.outgoingByCategory.length > 0 ? (
                          pnlData.data.outgoingByCategory.map((c) => (
                            <tr key={c.category} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-gray-900 font-medium">{c.category.replace(/_/g, ' ')}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-medium text-red-700">
                                <AmountDisplay amount={c.total} />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="px-4 py-6 text-center text-xs text-gray-400">
                              No outgoing payments in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 3: INCOMING PAYMENTS                                            */}
        {/* ==================================================================== */}
        {activeTab === 'incoming' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Incoming Payments Ledger</h3>
                <p className="text-xs text-gray-500">
                  Total Active Incoming:{' '}
                  <span className="font-mono font-semibold text-gray-800">
                    <AmountDisplay amount={incomingData?.data?.total || 0} />
                  </span>{' '}
                  ({incomingData?.data?.count || 0} total records)
                </p>
              </div>

              {/* CSV Export Controls with Scope Accuracy */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={handleExportIncomingPage}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                  title="Export currently loaded page"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Page CSV ({incomingPage})
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleExportIncomingAll}
                  disabled={isExportingIncomingAll}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                  title="Export all records matching current filter"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isExportingIncomingAll ? 'Fetching All...' : 'Export All Filtered CSV'}
                </Button>
              </div>
            </div>

            {isIncomingLoading ? (
              <div className="p-12 text-center text-gray-500">Loading incoming payments...</div>
            ) : isIncomingError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
                <span>Failed to load incoming payments.</span>
                <Button variant="secondary" onClick={() => refetchIncoming()} className="text-xs">
                  Retry
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Payment ID</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Party / Entity</th>
                        <th className="px-4 py-3 text-left font-medium">Category</th>
                        <th className="px-4 py-3 text-left font-medium">Mode</th>
                        <th className="px-4 py-3 text-right font-medium">Amount (INR)</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {incomingData?.data?.items && incomingData.data.items.length > 0 ? (
                        incomingData.data.items.map((item: IncomingReportItem) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-blue-600">
                              <Link to={`/payments/${item.id}`} className="hover:underline flex items-center gap-1">
                                {item.payment_id}
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {item.payment_date ? item.payment_date.split('T')[0] : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {item.party_name ? (
                                <Link to={`/parties/${item.party_id}`} className="hover:underline text-gray-900 font-medium">
                                  {item.party_name}
                                </Link>
                              ) : (
                                <span className="text-gray-500">{item.other_category_name || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {item.category.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {item.payment_mode}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-green-700">
                              <AmountDisplay amount={item.amount} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={item.payment_status} />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                            No incoming payments found for the selected period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {incomingData?.data && incomingData.data.count > pageSize && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                    <span>
                      Showing Page {incomingPage} of {Math.ceil(incomingData.data.count / pageSize)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={incomingPage <= 1}
                        onClick={() => setIncomingPage((p) => Math.max(p - 1, 1))}
                        className="py-1 px-2.5 text-xs"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={incomingPage >= Math.ceil(incomingData.data.count / pageSize)}
                        onClick={() => setIncomingPage((p) => p + 1)}
                        className="py-1 px-2.5 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 4: OUTGOING PAYMENTS                                            */}
        {/* ==================================================================== */}
        {activeTab === 'outgoing' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Outgoing Payments Ledger</h3>
                <p className="text-xs text-gray-500">
                  Total Active Outgoing:{' '}
                  <span className="font-mono font-semibold text-gray-800">
                    <AmountDisplay amount={outgoingData?.data?.total || 0} />
                  </span>{' '}
                  ({outgoingData?.data?.count || 0} total records)
                </p>
              </div>

              {/* CSV Export Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={handleExportOutgoingPage}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                  title="Export currently loaded page"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Page CSV ({outgoingPage})
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleExportOutgoingAll}
                  disabled={isExportingOutgoingAll}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                  title="Export all records matching current filter"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isExportingOutgoingAll ? 'Fetching All...' : 'Export All Filtered CSV'}
                </Button>
              </div>
            </div>

            {isOutgoingLoading ? (
              <div className="p-12 text-center text-gray-500">Loading outgoing payments...</div>
            ) : isOutgoingError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
                <span>Failed to load outgoing payments.</span>
                <Button variant="secondary" onClick={() => refetchOutgoing()} className="text-xs">
                  Retry
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Payment ID</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Recipient / Entity</th>
                        <th className="px-4 py-3 text-left font-medium">Category</th>
                        <th className="px-4 py-3 text-left font-medium">Mode</th>
                        <th className="px-4 py-3 text-right font-medium">Amount (INR)</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {outgoingData?.data?.items && outgoingData.data.items.length > 0 ? (
                        outgoingData.data.items.map((item: OutgoingReportItem) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-blue-600">
                              <Link to={`/payments/${item.id}`} className="hover:underline flex items-center gap-1">
                                {item.payment_id}
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {item.payment_date ? item.payment_date.split('T')[0] : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-900 font-medium">
                              {item.vehicle_owner_name ? (
                                <Link to={`/vehicle-owners/${item.vehicle_owner_id}`} className="hover:underline text-gray-900">
                                  {item.vehicle_owner_name}
                                </Link>
                              ) : (
                                <span className="text-gray-500">{item.other_category_name || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {item.category.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {item.payment_mode}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-red-700">
                              <AmountDisplay amount={item.amount} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={item.payment_status} />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                            No outgoing payments found for the selected period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {outgoingData?.data && outgoingData.data.count > pageSize && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                    <span>
                      Showing Page {outgoingPage} of {Math.ceil(outgoingData.data.count / pageSize)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={outgoingPage <= 1}
                        onClick={() => setOutgoingPage((p) => Math.max(p - 1, 1))}
                        className="py-1 px-2.5 text-xs"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={outgoingPage >= Math.ceil(outgoingData.data.count / pageSize)}
                        onClick={() => setOutgoingPage((p) => p + 1)}
                        className="py-1 px-2.5 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 5: PAYMENT MODES                                                */}
        {/* ==================================================================== */}
        {activeTab === 'modes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Payment Modes Breakdown</h3>
                <p className="text-xs text-gray-500">Distribution of active transactions across UPI, Bank Transfer, and Cash</p>
              </div>
              <Button
                variant="secondary"
                onClick={handleExportPaymentModes}
                className="flex items-center gap-1.5 text-xs py-1.5 px-3"
              >
                <Download className="w-3.5 h-3.5" />
                Export Modes CSV
              </Button>
            </div>

            {isModesLoading ? (
              <div className="p-12 text-center text-gray-500">Loading payment modes summary...</div>
            ) : isModesError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
                <span>Failed to load payment modes report.</span>
                <Button variant="secondary" onClick={() => refetchModes()} className="text-xs">
                  Retry
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Payment Mode</th>
                      <th className="px-4 py-3 text-right font-medium">Incoming Receipts (INR)</th>
                      <th className="px-4 py-3 text-right font-medium">Outgoing Expenses (INR)</th>
                      <th className="px-4 py-3 text-right font-medium">Net Movement (INR)</th>
                      <th className="px-4 py-3 text-center font-medium">Transaction Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {modesData?.data && modesData.data.length > 0 ? (
                      modesData.data.map((m: PaymentModeReportItem) => {
                        const inc = parseFloat(String(m.incoming_amount)) || 0;
                        const out = parseFloat(String(m.outgoing_amount)) || 0;
                        const net = inc - out;
                        return (
                          <tr key={m.payment_mode} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              {m.payment_mode.replace('_', ' ')}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-green-700 font-medium">
                              <AmountDisplay amount={m.incoming_amount} />
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-red-700 font-medium">
                              <AmountDisplay amount={m.outgoing_amount} />
                            </td>
                            <td className={`px-4 py-3 text-right font-mono font-medium ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              <AmountDisplay amount={net} />
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-gray-600">
                              {m.payment_count}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                          No transaction records for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 6: PARTY CREDITS                                                */}
        {/* ==================================================================== */}
        {activeTab === 'credits' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Party Credits Summary</h3>
                <p className="text-xs text-gray-500">
                  Derived from active payment allocations where receipts exceed invoice/trip requirements
                </p>
              </div>
            </div>

            {/* Scope Callout: Cumulative Reserve Balance */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-900 space-y-1">
                <span className="font-semibold block text-sm">Cumulative Position (All-Time Reserve)</span>
                <p>
                  Party credit reserves represent cumulative unutilized deposits that carry forward indefinitely across financial years until consumed against future bills or trips.
                </p>
                <p className="text-blue-800">
                  <strong>Filter Scope Notice:</strong> Date range and financial year filters do not apply to cumulative credit balances. Use the Party filter above to view reserves for a specific party or all parties.
                </p>
              </div>
            </div>

            {isCreditsLoading ? (
              <div className="p-12 text-center text-gray-500">Loading party credit positions...</div>
            ) : isCreditsError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
                <span>Failed to load credits report.</span>
                <Button variant="secondary" onClick={() => refetchCredits()} className="text-xs">
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Generated */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs uppercase font-semibold text-gray-500 block mb-1">
                      Total Credit Generated
                    </span>
                    <span className="text-2xl font-bold font-mono text-blue-700">
                      <AmountDisplay amount={creditsData?.data?.creditGenerated || 0} />
                    </span>
                    <p className="text-xs text-gray-500 mt-2">Excess incoming payment balances</p>
                  </div>

                  {/* Utilized */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs uppercase font-semibold text-gray-500 block mb-1">
                      Total Credit Utilized
                    </span>
                    <span className="text-2xl font-bold font-mono text-gray-700">
                      <AmountDisplay amount={creditsData?.data?.creditUtilized || 0} />
                    </span>
                    <p className="text-xs text-gray-500 mt-2">Applied to subsequent bills or trips</p>
                  </div>

                  {/* Remaining */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs uppercase font-semibold text-gray-500 block mb-1">
                      Remaining Available Credit
                    </span>
                    <span className="text-2xl font-bold font-mono text-green-700">
                      <AmountDisplay amount={creditsData?.data?.remainingCredit || 0} />
                    </span>
                    <p className="text-xs text-gray-500 mt-2">Authoritative outstanding credit reserve</p>
                  </div>
                </div>

                {/* Credit Invariant Explanatory Notice */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                  <p className="font-semibold">Business Rule on Party Credits:</p>
                  <p>
                    Party credits belong exclusively to Companies and Market Parties. Vehicle Owners do not receive credit balances under SRL transport rules; overpayments to vehicle owners are not converted into vehicle owner credits.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 7: TDS REPORT                                                   */}
        {/* ==================================================================== */}
        {activeTab === 'tds' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">TDS Deduction Ledger</h3>
                <p className="text-xs text-gray-500">
                  Total Recorded TDS Deductions:{' '}
                  <span className="font-mono font-semibold text-gray-800">
                    <AmountDisplay amount={tdsData?.data?.total || 0} />
                  </span>{' '}
                  ({tdsData?.data?.count || 0} qualifying trips)
                </p>
              </div>

              {/* TDS CSV Export */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={handleExportTdsPage}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                  title="Export currently loaded page"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Page CSV ({tdsPage})
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleExportTdsAll}
                  disabled={isExportingTdsAll}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                  title="Export all qualifying TDS records"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isExportingTdsAll ? 'Fetching All...' : 'Export All Filtered CSV'}
                </Button>
              </div>
            </div>

            {isTdsLoading ? (
              <div className="p-12 text-center text-gray-500">Loading TDS deduction records...</div>
            ) : isTdsError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
                <span>Failed to load TDS report.</span>
                <Button variant="secondary" onClick={() => refetchTds()} className="text-xs">
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* Authoritative Summary KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs uppercase font-semibold text-gray-500 block mb-1">
                      Total TDS Deductions
                    </span>
                    <span className="text-xl font-bold font-mono text-gray-900">
                      <AmountDisplay amount={tdsData?.data?.total || 0} />
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Sum of tax deductions on qualifying trips in this period</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs uppercase font-semibold text-gray-500 block mb-1">
                      Qualifying Trips
                    </span>
                    <span className="text-xl font-bold font-mono text-blue-700">
                      {tdsData?.data?.count || 0}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Trips with active TDS deduction in period</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Trip Number</th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Party / Company</th>
                      <th className="px-4 py-3 text-right font-medium">TDS Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tdsData?.data?.items && tdsData.data.items.length > 0 ? (
                      tdsData.data.items.map((item: TdsReportItem, idx: number) => (
                        <tr key={`${item.trip_number}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-blue-600">
                            {!isCa ? (
                              <Link to={`/trips`} className="hover:underline">
                                {item.trip_number}
                              </Link>
                            ) : (
                              <span>{item.trip_number}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {item.trip_date ? item.trip_date.split('T')[0] : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-900 font-medium">
                            {item.party_name}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                            <AmountDisplay amount={item.tds_amount} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-400 text-sm">
                          No TDS deductions found in this scope.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {tdsData?.data && tdsData.data.count > pageSize && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                    <span>
                      Showing Page {tdsPage} of {Math.ceil(tdsData.data.count / pageSize)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={tdsPage <= 1}
                        onClick={() => setTdsPage((p) => Math.max(p - 1, 1))}
                        className="py-1 px-2.5 text-xs"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={tdsPage >= Math.ceil(tdsData.data.count / pageSize)}
                        onClick={() => setTdsPage((p) => p + 1)}
                        className="py-1 px-2.5 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 8: BILL RECONCILIATION                                          */}
        {/* ==================================================================== */}
        {activeTab === 'bill-recon' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Bill Payment Reconciliation</h3>
                <p className="text-xs text-gray-500">
                  Track bill total, active payments allocated, and remaining outstanding balance ({billReconData?.data?.count || 0} bills)
                </p>
              </div>

              {/* Bill Recon CSV Export */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={handleExportBillReconPage}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                  title="Export currently loaded page"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Page CSV ({billReconPage})
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleExportBillReconAll}
                  disabled={isExportingBillReconAll}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                  title="Export all bills"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isExportingBillReconAll ? 'Fetching All...' : 'Export All Filtered CSV'}
                </Button>
              </div>
            </div>

            {isBillReconLoading ? (
              <div className="p-12 text-center text-gray-500">Loading bill reconciliation ledger...</div>
            ) : isBillReconError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
                <span>Failed to load bill reconciliation report.</span>
                <Button variant="secondary" onClick={() => refetchBillRecon()} className="text-xs">
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* Authoritative Summary KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs uppercase font-semibold text-gray-500 block mb-1">
                      Total Billed
                    </span>
                    <span className="text-xl font-bold font-mono text-gray-900">
                      <AmountDisplay amount={billReconData?.data?.totalBilled || 0} />
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Authoritative sum of all matching bills</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs uppercase font-semibold text-gray-500 block mb-1">
                      Total Allocated / Paid
                    </span>
                    <span className="text-xl font-bold font-mono text-green-700">
                      <AmountDisplay amount={billReconData?.data?.totalAllocated || 0} />
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Matched active payment allocations</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs uppercase font-semibold text-gray-500 block mb-1">
                      Total Outstanding Balance
                    </span>
                    <span className="text-xl font-bold font-mono text-amber-700">
                      <AmountDisplay amount={billReconData?.data?.totalOutstanding || 0} />
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Remaining unpaid bill obligations</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Bill Number</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Party / Company</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Total Amount</th>
                        <th className="px-4 py-3 text-right font-medium">Allocated Paid</th>
                        <th className="px-4 py-3 text-right font-medium">Outstanding Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {billReconData?.data?.items && billReconData.data.items.length > 0 ? (
                        billReconData.data.items.map((b: BillReconciliationItem) => (
                          <tr key={b.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-blue-600">
                              <Link to={`/bills/${b.id}`} className="hover:underline flex items-center gap-1">
                                {b.bill_number}
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {b.bill_date ? b.bill_date.split('T')[0] : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-900 font-medium">
                              {b.party_name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={b.bill_status} />
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-900">
                              <AmountDisplay amount={b.total_amount} />
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-green-700 font-medium">
                              <AmountDisplay amount={b.allocated_amount} />
                            </td>
                            <td className={`px-4 py-3 text-right font-mono font-medium ${parseFloat(String(b.balance_amount)) > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                              <AmountDisplay amount={b.balance_amount} />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                            No bills found in reconciliation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {billReconData?.data && billReconData.data.count > pageSize && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                    <span>
                      Showing Page {billReconPage} of {Math.ceil(billReconData.data.count / pageSize)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={billReconPage <= 1}
                        onClick={() => setBillReconPage((p) => Math.max(p - 1, 1))}
                        className="py-1 px-2.5 text-xs"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={billReconPage >= Math.ceil(billReconData.data.count / pageSize)}
                        onClick={() => setBillReconPage((p) => p + 1)}
                        className="py-1 px-2.5 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};
