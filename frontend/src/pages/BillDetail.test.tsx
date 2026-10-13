import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BillDetail from './BillDetail';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const renderWithProviders = (ui: React.ReactElement, initialRoute = '/bills/bill-1') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/bills/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mockBillDetail: api.BillDetail = {
  id: 'bill-1',
  bill_number: 'SRL/26-27/001',
  party_id: 'party-1',
  party_name: 'UltraTech Cement Ltd',
  financial_year_id: 'fy-1',
  financial_year_code: 'FY 2026-2027',
  billing_mode: 'CONSOLIDATED',
  bill_date: '2026-10-10',
  bill_status: 'GENERATED',
  total_amount: 150000,
  paid_amount: 0,
  balance_amount: 150000,
  current_version: 1,
  submitted_at: null,
  cancelled_at: null,
  cancel_reason: null,
  created_by: 'user-1',
  created_at: '2026-10-10T10:00:00Z',
  updated_at: '2026-10-10T10:00:00Z',
  party: {
    id: 'party-1',
    name: 'UltraTech Cement Ltd',
    primary_mobile: '9876543210',
    gstin: '24AAACU1234F1Z1',
    address: 'GIDC Industrial Area, Surat, Gujarat',
    city: 'Surat',
    state: 'Gujarat',
    pin_code: '395001'
  },
  financial_year: {
    id: 'fy-1',
    code: 'FY 2026-2027',
    start_date: '2026-04-01',
    end_date: '2027-03-31'
  },
  creator: {
    id: 'user-1',
    name: 'Owner User'
  },
  items: [
    {
      id: 'item-1',
      bill_id: 'bill-1',
      trip_id: 'trip-1',
      trip_number: 'TRIP-2026-0001',
      vehicle_number: 'RJ14-GA-1234',
      route_origin: 'Jaipur',
      route_destination: 'Ahmedabad',
      sequence_no: 1,
      description: 'Cement Transportation - 35MT',
      quantity: 35,
      unit_price: 2000,
      line_amount: 70000,
      is_active: true
    },
    {
      id: 'item-2',
      bill_id: 'bill-1',
      trip_id: 'trip-2',
      trip_number: 'TRIP-2026-0002',
      vehicle_number: 'RJ14-GB-5678',
      route_origin: 'Kotputli',
      route_destination: 'Surat',
      sequence_no: 2,
      description: 'Clinker Transportation - 40MT',
      quantity: 40,
      unit_price: 2000,
      line_amount: 80000,
      is_active: true
    }
  ],
  versions: [
    {
      id: 'ver-1',
      bill_id: 'bill-1',
      version_number: 1,
      version_label: 'v1',
      version_status: 'ACTIVE',
      template_snapshot: {},
      header_snapshot: {},
      totals_snapshot: { total_amount: 150000 },
      created_by: 'user-1',
      creator_name: 'Owner User',
      created_at: '2026-10-10T10:00:00Z',
      items: [
        {
          id: 'vitem-1',
          bill_id: 'bill-1',
          trip_id: 'trip-1',
          sequence_no: 1,
          description: 'Cement Transportation - 35MT',
          line_amount: 70000,
          is_active: true
        }
      ]
    }
  ],
  allocations: []
};

describe('BillDetail Page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ user: { id: '1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER' } });

    // Mock URL.createObjectURL and URL.revokeObjectURL
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  it('renders bill details with authoritative totals, line items, and version history', async () => {
    vi.mocked(api.getBill).mockResolvedValue({
      success: true,
      data: mockBillDetail
    });

    renderWithProviders(<BillDetail />);

    await waitFor(() => {
      expect(screen.getByText('Bill SRL/26-27/001')).toBeInTheDocument();
      expect(screen.getByText('UltraTech Cement Ltd')).toBeInTheDocument();
      expect(screen.getByText('Generated')).toBeInTheDocument();
      expect(screen.getByText('CONSOLIDATED')).toBeInTheDocument();
      expect(screen.getByText('Cement Transportation - 35MT')).toBeInTheDocument();
      expect(screen.getByText('TRIP-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('Clinker Transportation - 40MT')).toBeInTheDocument();
      expect(screen.getByText('TRIP-2026-0002')).toBeInTheDocument();
    });

    // Verify authoritative financial totals
    expect(screen.getByText('Total Bill Amount')).toBeInTheDocument();
    expect(screen.getByText('Paid Amount')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Balance')).toBeInTheDocument();

    // Verify action buttons exist for OWNER
    expect(screen.getByText('Submit Bill')).toBeInTheDocument();
    expect(screen.getByText('Correct / New Version')).toBeInTheDocument();
    expect(screen.getByText('Cancel Bill')).toBeInTheDocument();
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
  });

  it('submits a GENERATED bill successfully', async () => {
    vi.mocked(api.getBill).mockResolvedValue({
      success: true,
      data: mockBillDetail
    });

    vi.mocked(api.submitBill).mockResolvedValue({
      success: true,
      data: {
        ...mockBillDetail,
        bill_status: 'SUBMITTED'
      }
    });

    renderWithProviders(<BillDetail />);

    await waitFor(() => {
      expect(screen.getByText('Submit Bill')).toBeInTheDocument();
    });

    // Open submit modal
    fireEvent.click(screen.getByText('Submit Bill'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Submit')).toBeInTheDocument();
    });

    // Confirm submission
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Submit' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.submitBill).toHaveBeenCalledWith('bill-1');
    });
  });

  it('submits a correction creating a new version under the same bill number', async () => {
    vi.mocked(api.getBill).mockResolvedValue({
      success: true,
      data: mockBillDetail
    });

    vi.mocked(api.createBillVersion).mockResolvedValue({
      success: true,
      data: {
        id: 'ver-2',
        bill_id: 'bill-1',
        version_number: 2,
        version_label: 'v2',
        version_status: 'ACTIVE',
        template_snapshot: {},
        header_snapshot: {},
        totals_snapshot: { total_amount: 160000 },
        created_by: 'user-1',
        creator_name: 'Owner User',
        created_at: '2026-10-12T10:00:00Z',
        items: []
      }
    });

    renderWithProviders(<BillDetail />);

    await waitFor(() => {
      expect(screen.getByText('Correct / New Version')).toBeInTheDocument();
    });

    // Open correction modal
    fireEvent.click(screen.getByText('Correct / New Version'));

    await waitFor(() => {
      expect(screen.getByText('Correct Bill — Create Version 2')).toBeInTheDocument();
    });

    // Submit correction
    const saveVersionBtn = screen.getByRole('button', { name: 'Save as Version 2' });
    fireEvent.click(saveVersionBtn);

    await waitFor(() => {
      expect(api.createBillVersion).toHaveBeenCalledWith('bill-1', {
        items: expect.any(Array)
      });
    });
  });

  it('rejects cancellation when backend responds with BILL_HAS_ACTIVE_ALLOCATIONS', async () => {
    vi.mocked(api.getBill).mockResolvedValue({
      success: true,
      data: mockBillDetail
    });

    vi.mocked(api.cancelBill).mockRejectedValue({
      response: {
        data: {
          error: {
            code: 'BILL_HAS_ACTIVE_ALLOCATIONS',
            message: 'Cannot cancel bill with active allocations.'
          }
        }
      }
    });

    renderWithProviders(<BillDetail />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Bill')).toBeInTheDocument();
    });

    // Open cancel modal
    fireEvent.click(screen.getByText('Cancel Bill'));

    await waitFor(() => {
      expect(screen.getByText('Cancel Bill SRL/26-27/001')).toBeInTheDocument();
    });

    // Enter cancellation reason
    const reasonInput = screen.getByPlaceholderText('Explain reason for cancelling this bill (min 5 characters)...');
    fireEvent.change(reasonInput, { target: { value: 'Customer requested cancellation.' } });

    // Confirm cancel
    const confirmCancelBtn = screen.getByRole('button', { name: 'Confirm Cancellation' });
    fireEvent.click(confirmCancelBtn);

    await waitFor(() => {
      expect(api.cancelBill).toHaveBeenCalledWith('bill-1', 'Customer requested cancellation.');
      expect(screen.getByText('Cannot cancel bill with active payment allocations. Reallocate or reverse linked payments through the Payment Module first.')).toBeInTheDocument();
    });
  });

  it('hides Cancel Bill button for STAFF role', async () => {
    useAuthStore.setState({ user: { id: '2', name: 'Staff User', email: 'staff@example.com', role: 'STAFF' } });

    vi.mocked(api.getBill).mockResolvedValue({
      success: true,
      data: mockBillDetail
    });

    renderWithProviders(<BillDetail />);

    await waitFor(() => {
      expect(screen.getByText('Bill SRL/26-27/001')).toBeInTheDocument();
    });

    // STAFF can Submit and Correct, but CANNOT cancel
    expect(screen.getByText('Submit Bill')).toBeInTheDocument();
    expect(screen.getByText('Correct / New Version')).toBeInTheDocument();
    expect(screen.queryByText('Cancel Bill')).not.toBeInTheDocument();
  });

  it('hides all mutation buttons for CA role (read-only)', async () => {
    useAuthStore.setState({ user: { id: '3', name: 'CA User', email: 'ca@example.com', role: 'CA' } });

    vi.mocked(api.getBill).mockResolvedValue({
      success: true,
      data: mockBillDetail
    });

    renderWithProviders(<BillDetail />);

    await waitFor(() => {
      expect(screen.getByText('Bill SRL/26-27/001')).toBeInTheDocument();
    });

    // CA can download PDF
    expect(screen.getByText('Download PDF')).toBeInTheDocument();

    // Mutations are completely hidden
    expect(screen.queryByText('Submit Bill')).not.toBeInTheDocument();
    expect(screen.queryByText('Correct / New Version')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel Bill')).not.toBeInTheDocument();
  });

  it('downloads PDF when clicking Download PDF', async () => {
    vi.mocked(api.getBill).mockResolvedValue({
      success: true,
      data: mockBillDetail
    });

    const mockBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
    vi.mocked(api.downloadBillPdf).mockResolvedValue(mockBlob);

    renderWithProviders(<BillDetail />);

    await waitFor(() => {
      expect(screen.getByText('Download PDF')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => {
      expect(api.downloadBillPdf).toHaveBeenCalledWith('bill-1', undefined);
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    });
  });

  it('renders cancellation banner when bill is CANCELLED', async () => {
    const cancelledBill: api.BillDetail = {
      ...mockBillDetail,
      bill_status: 'CANCELLED',
      cancel_reason: 'Rate disputed by customer',
      canceller: {
        id: 'user-1',
        name: 'Owner User'
      },
      cancelled_at: '2026-10-12T15:30:00Z'
    };

    vi.mocked(api.getBill).mockResolvedValue({
      success: true,
      data: cancelledBill
    });

    renderWithProviders(<BillDetail />);

    await waitFor(() => {
      expect(screen.getByText('Bill Cancelled')).toBeInTheDocument();
      expect(screen.getByText(/Rate disputed by customer/)).toBeInTheDocument();
      expect(screen.getByText(/By: Owner User/)).toBeInTheDocument();
    });

    // No mutation buttons visible on cancelled bills
    expect(screen.queryByText('Submit Bill')).not.toBeInTheDocument();
    expect(screen.queryByText('Correct / New Version')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel Bill')).not.toBeInTheDocument();
  });
});
