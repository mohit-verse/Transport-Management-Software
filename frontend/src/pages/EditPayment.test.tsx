import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditPayment from './EditPayment';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (paymentId: string) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/payments/${paymentId}/edit`]}>
        <Routes>
          <Route path="/payments/:id/edit" element={<EditPayment />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('EditPayment Page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
    useAuthStore.setState({ user: { id: '1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER' } });
  });

  const samplePayment: api.Payment = {
    id: 'pay-1',
    payment_id: 'PAY-2026-0001',
    payment_date: '2026-10-10',
    payment_type: 'INCOMING',
    category: 'COMPANY_PAYMENT',
    amount: 50000,
    payment_mode: 'BANK_TRANSFER',
    payment_status: 'ACTIVE',
    party_id: 'party-1',
    party_name: 'Shree Cement Ltd',
    created_at: '2026-10-10T10:00:00Z',
    updated_at: '2026-10-10T10:00:00Z'
  };

  it('renders editable fields and locked summary information', async () => {
    vi.mocked(api.getPayment).mockResolvedValue({
      success: true,
      data: samplePayment
    });

    renderWithProviders('pay-1');

    await waitFor(() => {
      expect(screen.getByText('Edit Payment PAY-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('Shree Cement Ltd')).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText(/Payment Date/);
    expect(dateInput).toHaveValue('2026-10-10');

    const modeSelect = screen.getByLabelText(/Payment Mode/);
    expect(modeSelect).toHaveValue('BANK_TRANSFER');
  });

  it('prohibits editing and disables form when payment is reversed', async () => {
    vi.mocked(api.getPayment).mockResolvedValue({
      success: true,
      data: {
        ...samplePayment,
        payment_status: 'REVERSED',
        reversal_reason: 'Cheque bounced'
      }
    });

    renderWithProviders('pay-1');

    await waitFor(() => {
      expect(screen.getByText('Editing Prohibited')).toBeInTheDocument();
      expect(screen.getByText(/This payment was reversed and cannot be edited/)).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/ });
    expect(saveBtn).toBeDisabled();

    const dateInput = screen.getByLabelText(/Payment Date/);
    expect(dateInput).toBeDisabled();
  });

  it('submits updated date and mode calling updatePayment', async () => {
    vi.mocked(api.getPayment).mockResolvedValue({
      success: true,
      data: samplePayment
    });
    vi.mocked(api.updatePayment).mockResolvedValue({
      success: true,
      data: {
        ...samplePayment,
        payment_date: '2026-10-11',
        payment_mode: 'UPI'
      }
    });

    renderWithProviders('pay-1');

    await waitFor(() => {
      expect(screen.getByText('Edit Payment PAY-2026-0001')).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText(/Payment Date/);
    fireEvent.change(dateInput, { target: { value: '2026-10-11' } });

    const modeSelect = screen.getByLabelText(/Payment Mode/);
    fireEvent.change(modeSelect, { target: { value: 'UPI' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/ });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.updatePayment).toHaveBeenCalledWith('pay-1', {
        payment_date: '2026-10-11',
        payment_mode: 'UPI'
      });
    });
  });
});
