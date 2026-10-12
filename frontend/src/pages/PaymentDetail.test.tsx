import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentDetail from './PaymentDetail';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (paymentId: string) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/payments/${paymentId}`]}>
        <Routes>
          <Route path="/payments/:id" element={<PaymentDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('PaymentDetail Page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
    useAuthStore.setState({ user: { id: '1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER' } });
  });

  const activePayment: api.Payment = {
    id: 'pay-1',
    payment_id: 'PAY-2026-0001',
    payment_date: '2026-10-10',
    payment_type: 'INCOMING',
    category: 'COMPANY_PAYMENT',
    amount: 100000,
    payment_mode: 'BANK_TRANSFER',
    payment_status: 'ACTIVE',
    party_id: 'party-1',
    party_name: 'Shree Cement Ltd',
    created_at: '2026-10-10T10:00:00Z',
    updated_at: '2026-10-10T10:00:00Z',
    allocations: [
      {
        id: 'alloc-1',
        payment_id: 'pay-1',
        allocation_type: 'BILL',
        allocation_amount: 80000,
        allocation_status: 'ACTIVE',
        bill_id: 'bill-1',
        bill_number: 'SRL/26-27/001',
        created_at: '2026-10-10T10:00:00Z'
      },
      {
        id: 'alloc-2',
        payment_id: 'pay-1',
        allocation_type: 'CREDIT_GENERATED',
        allocation_amount: 20000,
        allocation_status: 'ACTIVE',
        created_at: '2026-10-10T10:00:00Z'
      }
    ],
    documents: [],
    audit_history: [
      {
        id: 'audit-1',
        action_type: 'PAYMENT_CREATED',
        event_time: '2026-10-10T10:00:00Z',
        actor_user_id: '1',
        actor_name: 'Owner User'
      }
    ]
  };

  it('renders payment details, allocations, and Owner actions', async () => {
    vi.mocked(api.getPayment).mockResolvedValue({
      success: true,
      data: activePayment
    });

    renderWithProviders('pay-1');

    await waitFor(() => {
      expect(screen.getByText('Payment PAY-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('Shree Cement Ltd')).toBeInTheDocument();
      expect(screen.getByText('SRL/26-27/001')).toBeInTheDocument();
      expect(screen.getByText('Party Balance Credit')).toBeInTheDocument();
      expect(screen.getByText('PAYMENT_CREATED')).toBeInTheDocument();
      expect(screen.getByText('Reverse Payment')).toBeInTheDocument();
      expect(screen.getByText('Reallocate')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  it('hides Reverse and Reallocate buttons for STAFF user', async () => {
    useAuthStore.setState({ user: { id: '2', name: 'Staff User', email: 'staff@example.com', role: 'STAFF' } });

    vi.mocked(api.getPayment).mockResolvedValue({
      success: true,
      data: activePayment
    });

    renderWithProviders('pay-1');

    await waitFor(() => {
      expect(screen.getByText('Payment PAY-2026-0001')).toBeInTheDocument();
      expect(screen.queryByText('Reverse Payment')).not.toBeInTheDocument();
      expect(screen.queryByText('Reallocate')).not.toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument(); // Staff can edit permitted fields
    });
  });

  it('displays prominent reversal banner and hides destructive actions when reversed', async () => {
    const reversedPayment: api.Payment = {
      ...activePayment,
      payment_status: 'REVERSED',
      reversal_reason: 'Entered duplicate cheque number by mistake',
      reversed_by: 'Owner User',
      reversed_at: '2026-10-12T15:00:00Z'
    };

    vi.mocked(api.getPayment).mockResolvedValue({
      success: true,
      data: reversedPayment
    });

    renderWithProviders('pay-1');

    await waitFor(() => {
      expect(screen.getByText('Payment Reversed')).toBeInTheDocument();
      expect(screen.getByText(/Entered duplicate cheque number by mistake/)).toBeInTheDocument();
      expect(screen.queryByText('Reverse Payment')).not.toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Reallocate')).not.toBeInTheDocument();
    });
  });

  it('opens reversal modal, validates reason, and executes reversal', async () => {
    vi.mocked(api.getPayment).mockResolvedValue({
      success: true,
      data: activePayment
    });
    vi.mocked(api.reversePayment).mockResolvedValue({
      success: true,
      data: { ...activePayment, payment_status: 'REVERSED' }
    });

    renderWithProviders('pay-1');

    await waitFor(() => {
      expect(screen.getByText('Reverse Payment')).toBeInTheDocument();
    });

    // Click Reverse Payment
    fireEvent.click(screen.getByText('Reverse Payment'));

    // Modal should appear
    expect(screen.getByPlaceholderText(/Enter detailed reason for payment reversal/)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Enter detailed reason for payment reversal/);
    fireEvent.change(textarea, { target: { value: 'Valid reversal reason here' } });

    const confirmBtn = screen.getByText('Confirm Reversal');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.reversePayment).toHaveBeenCalledWith('pay-1', 'Valid reversal reason here');
    });
  });
});
