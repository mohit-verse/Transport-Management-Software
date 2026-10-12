import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatePayment from './CreatePayment';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('CreatePayment Page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
    useAuthStore.setState({ user: { id: '1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER' } });

    vi.mocked(api.getParties).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'party-1',
          name: 'Ambuja Cements',
          party_type: 'COMPANY',
          primary_mobile: '9876543210',
          is_tds_applicable: false,
          created_at: '2026-01-01',
          updated_at: '2026-01-01'
        }
      ]
    });

    vi.mocked(api.getVehicleOwners).mockResolvedValue({ success: true, data: [] });
    vi.mocked(api.getOtherBusinessCategories).mockResolvedValue({ success: true, data: [] });
    vi.mocked(api.getOwnFleetVehicles).mockResolvedValue({ success: true, data: [] });
    vi.mocked(api.getPartyBills).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'bill-1',
          bill_number: 'SRL/26-27/001',
          total_amount: 50000,
          status: 'GENERATED'
        }
      ]
    });
    vi.mocked(api.getPartyTrips).mockResolvedValue({ success: true, data: [] });
  });

  it('renders payment form and disables submit when unallocated', async () => {
    renderWithProviders(<CreatePayment />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Record Payment' })).toBeInTheDocument();
      expect(screen.getByText('1. Payment Classification')).toBeInTheDocument();
      expect(screen.getByText('2. Associated Entity')).toBeInTheDocument();
      expect(screen.getByText('3. Payment Details')).toBeInTheDocument();
    });

    // Enter Amount
    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '50000' } });

    // Without complete allocation, button should be disabled
    const submitBtn = screen.getByRole('button', { name: 'Record Payment' });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/Remaining: ₹50000.00/)).toBeInTheDocument();
  });

  it('enables submit when allocation satisfies completeness invariant and submits', async () => {
    vi.mocked(api.createPayment).mockResolvedValue({
      success: true,
      data: {
        id: 'new-pay-id',
        payment_id: 'PAY-2026-0005',
        amount: 50000,
        payment_type: 'INCOMING',
        category: 'COMPANY_PAYMENT',
        payment_mode: 'BANK_TRANSFER',
        payment_status: 'ACTIVE',
        payment_date: '2026-10-12',
        created_at: '2026-10-12',
        updated_at: '2026-10-12'
      }
    });

    renderWithProviders(<CreatePayment />);

    await waitFor(() => {
      expect(screen.getByText('Ambuja Cements (COMPANY) - 9876543210')).toBeInTheDocument();
    });

    // Select Party
    const partySelect = screen.getByLabelText(/Select Party \/ Company/);
    fireEvent.change(partySelect, { target: { value: 'party-1' } });

    // Enter Total Amount
    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '50000' } });

    // Click Add Bill
    const addBillBtn = screen.getByText('+ Add Bill');
    fireEvent.click(addBillBtn);

    await waitFor(() => {
      expect(screen.getByText(/Bill #SRL\/26-27\/001/)).toBeInTheDocument();
    });

    // Select the bill in the allocation row
    const billSelect = screen.getByText('-- Select Bill --').closest('select')!;
    fireEvent.change(billSelect, { target: { value: 'bill-1' } });

    // Invariant should now show 100% Fully Allocated
    await waitFor(() => {
      expect(screen.getByText('100% Fully Allocated (Complete)')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: 'Record Payment' });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createPayment).toHaveBeenCalledWith(expect.objectContaining({
        amount: 50000,
        payment_direction: 'INCOMING',
        payment_category: 'COMPANY_PAYMENT',
        party_id: 'party-1',
        allocations: expect.arrayContaining([
          expect.objectContaining({
            allocation_type: 'BILL',
            allocated_amount: 50000,
            target_bill_id: 'bill-1'
          })
        ])
      }));
    });
  });
});
