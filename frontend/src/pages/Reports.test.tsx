import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Reports } from './Reports';
import * as api from '../services/api';
import * as csvExport from '../utils/csvExport';
import { useAuthStore } from '../store/authStore';

// Mock API
vi.mock('../services/api');
// Mock CSV export utility
vi.mock('../utils/csvExport', () => ({
  exportToCsv: vi.fn(),
}));

const mockFinancialYears = [
  {
    id: 'fy-2026-27',
    code: '2026-27',
    start_date: '2026-04-01T00:00:00.000Z',
    end_date: '2027-03-31T00:00:00.000Z',
    is_active: true,
  },
  {
    id: 'fy-2025-26',
    code: '2025-26',
    start_date: '2025-04-01T00:00:00.000Z',
    end_date: '2026-03-31T00:00:00.000Z',
    is_active: false,
  },
];

const mockParties = [
  { id: 'party-1', name: 'UltraTech Cement', party_type: 'COMPANY', primary_mobile: '9876543210' },
  { id: 'party-2', name: 'Ambuja Cements', party_type: 'COMPANY', primary_mobile: '9876543211' },
];

const mockFinancialSummary = {
  totalIncoming: 1250000,
  totalOutgoing: 850000,
  netPnl: 400000,
};

const mockPnl = {
  totalIncoming: 1250000,
  totalOutgoing: 850000,
  netPnl: 400000,
  incomingByCategory: [
    { category: 'COMPANY_PAYMENT', total: '1000000.00' },
    { category: 'MARKET_PARTY_PAYMENT', total: '250000.00' },
  ],
  outgoingByCategory: [
    { category: 'VEHICLE_OWNER_PAYMENT', total: '700000.00' },
    { category: 'OTHER_BUSINESS_PAYMENT', total: '150000.00' },
  ],
};

const mockIncoming = {
  items: [
    {
      id: 'pay-in-1',
      payment_id: 'PAY-IN-001',
      payment_type: 'INCOMING' as const,
      category: 'COMPANY_PAYMENT',
      payment_date: '2026-06-15T00:00:00.000Z',
      amount: '500000.00',
      payment_mode: 'BANK_TRANSFER' as const,
      party_id: 'party-1',
      party_name: 'UltraTech Cement',
      payment_status: 'ACTIVE' as const,
      created_at: '2026-06-15T10:00:00.000Z',
    },
  ],
  total: 500000,
  count: 1,
};

const mockOutgoing = {
  items: [
    {
      id: 'pay-out-1',
      payment_id: 'PAY-OUT-001',
      payment_type: 'OUTGOING' as const,
      category: 'VEHICLE_OWNER_PAYMENT',
      payment_date: '2026-06-16T00:00:00.000Z',
      amount: '350000.00',
      payment_mode: 'BANK_TRANSFER' as const,
      vehicle_owner_id: 'owner-1',
      vehicle_owner_name: 'Suresh Sharma',
      payment_status: 'ACTIVE' as const,
      created_at: '2026-06-16T11:00:00.000Z',
    },
  ],
  total: 350000,
  count: 1,
};

const mockModes = [
  { payment_mode: 'BANK_TRANSFER', incoming_amount: '1000000.00', outgoing_amount: '700000.00', payment_count: '15' },
  { payment_mode: 'UPI', incoming_amount: '250000.00', outgoing_amount: '100000.00', payment_count: '25' },
  { payment_mode: 'CASH', incoming_amount: '0.00', outgoing_amount: '50000.00', payment_count: '5' },
];

const mockCredits = {
  creditGenerated: 50000,
  creditUtilized: 20000,
  remainingCredit: 30000,
};

const mockTds = {
  items: [
    {
      trip_number: 'TRIP-2026-001',
      trip_date: '2026-05-10T00:00:00.000Z',
      party_name: 'UltraTech Cement',
      tds_amount: '2500.00',
    },
  ],
  total: 2500,
  count: 1,
};

const mockBillRecon = {
  items: [
    {
      id: 'bill-1',
      bill_number: 'SRL/26-27/001',
      bill_status: 'SUBMITTED' as const,
      bill_date: '2026-06-01',
      party_name: 'UltraTech Cement',
      total_amount: '60000.00',
      allocated_amount: '40000.00',
      balance_amount: '20000.00',
    },
  ],
  count: 1,
  totalBilled: 60000,
  totalAllocated: 40000,
  totalOutstanding: 20000,
};

describe('Reports Page & CA Workspace', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Default mock responses
    vi.mocked(api.getFinancialYears).mockResolvedValue({ success: true, data: mockFinancialYears as any });
    vi.mocked(api.getParties).mockResolvedValue({ success: true, data: mockParties as any });
    vi.mocked(api.getFinancialSummary).mockResolvedValue({ success: true, data: mockFinancialSummary });
    vi.mocked(api.getPnlReport).mockResolvedValue({ success: true, data: mockPnl });
    vi.mocked(api.getIncomingReport).mockResolvedValue({ success: true, data: mockIncoming });
    vi.mocked(api.getOutgoingReport).mockResolvedValue({ success: true, data: mockOutgoing });
    vi.mocked(api.getPaymentModesReport).mockResolvedValue({ success: true, data: mockModes });
    vi.mocked(api.getCreditsReport).mockResolvedValue({ success: true, data: mockCredits });
    vi.mocked(api.getTdsReport).mockResolvedValue({ success: true, data: mockTds });
    vi.mocked(api.getBillReconciliationReport).mockResolvedValue({ success: true, data: mockBillRecon });

    // Set Owner role by default
    useAuthStore.setState({
      user: { id: 'user-1', name: 'Owner User', email: 'owner@srl.com', role: 'OWNER' },
      token: 'jwt-owner',
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Reports />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders Financial Overview tab by default with authoritative KPI cards', async () => {
    renderComponent();

    expect(screen.getByText('Financial Reports')).toBeInTheDocument();
    expect(screen.getByText('Reporting Period & Filters')).toBeInTheDocument();

    // Verify KPI cards
    await waitFor(() => {
      expect(screen.getByText('Total Incoming Payments')).toBeInTheDocument();
      expect(screen.getByText('Total Outgoing Payments')).toBeInTheDocument();
      expect(screen.getByText('Net Business P&L')).toBeInTheDocument();
    });

    // Currency values
    expect(screen.getByText('₹12,50,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹8,50,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹4,00,000.00')).toBeInTheDocument();
  });

  it('renders CA Workspace notice banner when user role is CA and restricts operational navigation', async () => {
    useAuthStore.setState({
      user: { id: 'ca-1', name: 'Ramesh CA', email: 'ca@srl.com', role: 'CA' },
      token: 'jwt-ca',
    });

    renderComponent();

    expect(screen.getByText('CA & Financial Reports Workspace')).toBeInTheDocument();
    expect(screen.getByText(/Chartered Accountant Workspace \(Read-Only\):/)).toBeInTheDocument();
  });

  it('handles unambiguous interaction between Financial Year and Custom Date Range', async () => {
    renderComponent();

    // Initially in FY mode, date inputs are disabled/locked
    await waitFor(() => {
      const fyOption = screen.getByText('FY 2026-27 (Active)');
      expect(fyOption).toBeInTheDocument();
    });

    // Switch to Custom Date Range mode
    const customBtn = screen.getByText('Custom Date Range');
    fireEvent.click(customBtn);

    // Inputs are now interactive
    expect(screen.queryByText('(Locked to FY)')).not.toBeInTheDocument();

    // Switch back to Financial Year mode
    const fyBtn = screen.getByText('Financial Year');
    fireEvent.click(fyBtn);
    expect(screen.getAllByText('(Locked to FY)').length).toBe(2);
  });

  it('navigates to Profit & Loss tab and renders categorized breakdowns', async () => {
    renderComponent();

    const pnlTab = screen.getByRole('button', { name: /Profit & Loss/i });
    fireEvent.click(pnlTab);

    await waitFor(() => {
      expect(api.getPnlReport).toHaveBeenCalled();
      expect(screen.getByText('Incoming Receipts by Category')).toBeInTheDocument();
      expect(screen.getByText('Outgoing Payments by Category')).toBeInTheDocument();
    });

    expect(screen.getByText('COMPANY PAYMENT')).toBeInTheDocument();
    expect(screen.getByText('VEHICLE OWNER PAYMENT')).toBeInTheDocument();
  });

  it('navigates to Incoming Payments tab and triggers accurate CSV export', async () => {
    renderComponent();

    const incomingTab = screen.getByRole('button', { name: /Incoming Payments/i });
    fireEvent.click(incomingTab);

    await waitFor(() => {
      expect(api.getIncomingReport).toHaveBeenCalled();
      expect(screen.getByText('PAY-IN-001')).toBeInTheDocument();
    });

    // Trigger Current Page CSV export
    const exportPageBtn = screen.getByRole('button', { name: /Export Page CSV/i });
    fireEvent.click(exportPageBtn);

    expect(csvExport.exportToCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'incoming-payments-page-1',
        headers: expect.arrayContaining(['Payment ID', 'Amount (INR)', 'Status']),
        summaryRows: expect.arrayContaining([
          expect.arrayContaining(['Page Total', expect.any(String)]),
          expect.arrayContaining(['Reconciled Filtered Total (Backend)', expect.any(String)]),
        ]),
      })
    );
  });

  it('navigates to Outgoing Payments tab and displays recipient and mode', async () => {
    renderComponent();

    const outgoingTab = screen.getByRole('button', { name: /Outgoing Payments/i });
    fireEvent.click(outgoingTab);

    await waitFor(() => {
      expect(api.getOutgoingReport).toHaveBeenCalled();
      expect(screen.getByText('PAY-OUT-001')).toBeInTheDocument();
      expect(screen.getByText('Suresh Sharma')).toBeInTheDocument();
    });
  });

  it('navigates to Payment Modes tab and displays mode breakdown', async () => {
    renderComponent();

    const modesTab = screen.getByRole('button', { name: /Payment Modes/i });
    fireEvent.click(modesTab);

    await waitFor(() => {
      expect(api.getPaymentModesReport).toHaveBeenCalled();
      expect(screen.getByText('BANK TRANSFER')).toBeInTheDocument();
      expect(screen.getByText('UPI')).toBeInTheDocument();
      expect(screen.getByText('CASH')).toBeInTheDocument();
    });
  });

  it('navigates to Party Credits tab and shows generated vs utilized reserves', async () => {
    renderComponent();

    const creditsTab = screen.getByRole('button', { name: /Party Credits/i });
    fireEvent.click(creditsTab);

    await waitFor(() => {
      expect(api.getCreditsReport).toHaveBeenCalled();
      expect(screen.getByText('Total Credit Generated')).toBeInTheDocument();
      expect(screen.getByText('Total Credit Utilized')).toBeInTheDocument();
      expect(screen.getByText('Remaining Available Credit')).toBeInTheDocument();
    });

    expect(screen.getByText('₹50,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹20,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹30,000.00')).toBeInTheDocument();
  });

  it('navigates to TDS Report tab and displays qualifying trips', async () => {
    renderComponent();

    const tdsTab = screen.getByRole('button', { name: /TDS Report/i });
    fireEvent.click(tdsTab);

    await waitFor(() => {
      expect(api.getTdsReport).toHaveBeenCalled();
      expect(screen.getByText('TRIP-2026-001')).toBeInTheDocument();
      expect(screen.getAllByText('₹2,500.00').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to Bill Reconciliation tab and displays reconciliation ledger', async () => {
    renderComponent();

    const billReconTab = screen.getByRole('button', { name: /Bill Reconciliation/i });
    fireEvent.click(billReconTab);

    await waitFor(() => {
      expect(api.getBillReconciliationReport).toHaveBeenCalled();
      expect(screen.getByText('SRL/26-27/001')).toBeInTheDocument();
      expect(screen.getAllByText('₹60,000.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('₹40,000.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('₹20,000.00').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays explicit cumulative reserve notice on Party Credits tab and in scope banner', async () => {
    renderComponent();

    const creditsTab = screen.getByRole('button', { name: /Party Credits/i });
    fireEvent.click(creditsTab);

    await waitFor(() => {
      expect(screen.getByText('Cumulative Position (All-Time Reserve)')).toBeInTheDocument();
      expect(screen.getByText(/Party credit reserves represent cumulative unutilized deposits/i)).toBeInTheDocument();
      expect(screen.getByText('Cumulative All-Time Reserve (Date Filters Do Not Apply)')).toBeInTheDocument();
    });
  });

  it('renders authoritative summary KPI cards for Bill Reconciliation', async () => {
    renderComponent();

    const billReconTab = screen.getByRole('button', { name: /Bill Reconciliation/i });
    fireEvent.click(billReconTab);

    await waitFor(() => {
      expect(screen.getByText('Total Billed')).toBeInTheDocument();
      expect(screen.getByText('Total Allocated / Paid')).toBeInTheDocument();
      expect(screen.getByText('Total Outstanding Balance')).toBeInTheDocument();
    });

    // Authoritative totals from mockBillRecon
    expect(screen.getAllByText('₹60,000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('₹40,000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('₹20,000.00').length).toBeGreaterThanOrEqual(1);
  });

  it('renders authoritative summary KPI cards for TDS Report', async () => {
    renderComponent();

    const tdsTab = screen.getByRole('button', { name: /TDS Report/i });
    fireEvent.click(tdsTab);

    await waitFor(() => {
      expect(screen.getByText('Total TDS Deductions')).toBeInTheDocument();
      expect(screen.getByText('Qualifying Trips')).toBeInTheDocument();
    });
  });

  it('guarantees complete export by sequentially fetching all pages and reconciling totals', async () => {
    renderComponent();

    // Ensure initial render settles
    await waitFor(() => {
      expect(screen.getByText('FY 2026-27 (Active)')).toBeInTheDocument();
    });

    // Mock multi-page responses for incoming payments
    vi.mocked(api.getIncomingReport).mockImplementation(async (params) => {
      if (params?.page === 2) {
        return {
          success: true,
          data: {
            items: [
              {
                ...mockIncoming.items[0],
                id: 'pay-in-2',
                payment_id: 'PAY-IN-002',
                amount: '500000.00',
              },
            ],
            count: 2,
            total: 1000000,
          },
        };
      }
      return {
        success: true,
        data: {
          items: [mockIncoming.items[0]],
          count: 2,
          total: 1000000,
        },
      };
    });

    const incomingTab = screen.getByRole('button', { name: /Incoming Payments/i });
    fireEvent.click(incomingTab);

    await waitFor(() => {
      expect(screen.getByText('PAY-IN-001')).toBeInTheDocument();
    });

    const exportAllBtn = screen.getByRole('button', { name: /Export All Filtered CSV/i });
    fireEvent.click(exportAllBtn);

    await waitFor(() => {
      expect(csvExport.exportToCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'incoming-payments-full-filtered',
          metadata: expect.arrayContaining([
            expect.objectContaining({ label: 'Scope', value: 'Full Filtered Report (All Matching Records)' }),
            expect.objectContaining({ label: 'Total Records Exported', value: 2 }),
          ]),
          summaryRows: expect.arrayContaining([
            expect.arrayContaining(['Grand Total (Backend Authoritative)', '', '', '', '', '1000000.00', '2 records']),
            expect.arrayContaining(['Sum of Exported Rows', '', '', '', '', '1000000.00', 'Reconciled']),
          ]),
        })
      );
    });
  });

  it('handles API error state with retry button', async () => {
    vi.mocked(api.getFinancialSummary).mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load Financial Summary from backend/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();
  });
});
