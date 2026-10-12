import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Payments from './Payments';
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

describe('Payments List Page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
    useAuthStore.setState({ user: { id: '1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER' } });
  });

  it('renders payment list with columns, amounts, and badges', async () => {
    vi.mocked(api.getPayments).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'pay-1',
          payment_id: 'PAY-2026-0001',
          payment_date: '2026-10-10',
          payment_type: 'INCOMING',
          category: 'COMPANY_PAYMENT',
          amount: 50000,
          payment_mode: 'BANK_TRANSFER',
          payment_status: 'ACTIVE',
          party_id: 'party-1',
          party_name: 'UltraTech Cement',
          created_at: '2026-10-10T10:00:00Z',
          updated_at: '2026-10-10T10:00:00Z'
        },
        {
          id: 'pay-2',
          payment_id: 'PAY-2026-0002',
          payment_date: '2026-10-11',
          payment_type: 'OUTGOING',
          category: 'VEHICLE_OWNER_PAYMENT',
          amount: 25000,
          payment_mode: 'UPI',
          payment_status: 'REVERSED',
          vehicle_owner_id: 'owner-1',
          vehicle_owner_name: 'Rajesh Sharma',
          created_at: '2026-10-11T10:00:00Z',
          updated_at: '2026-10-11T10:00:00Z'
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1
      }
    });

    renderWithProviders(<Payments />);

    await waitFor(() => {
      expect(screen.getAllByText('PAY-2026-0001')[0]).toBeInTheDocument();
      expect(screen.getAllByText('PAY-2026-0002')[0]).toBeInTheDocument();
      expect(screen.getAllByText('UltraTech Cement')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Rajesh Sharma')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Bank Transfer')[0]).toBeInTheDocument();
      expect(screen.getAllByText('UPI')[0]).toBeInTheDocument();
    });

    // Verify Record Payment button exists for OWNER
    expect(screen.getByText('Record Payment')).toBeInTheDocument();
  });

  it('hides Record Payment button for CA role', async () => {
    useAuthStore.setState({ user: { id: '3', name: 'CA User', email: 'ca@example.com', role: 'CA' } });

    vi.mocked(api.getPayments).mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });

    renderWithProviders(<Payments />);

    await waitFor(() => {
      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });
  });

  it('handles search input filter and refetches', async () => {
    vi.mocked(api.getPayments).mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });

    renderWithProviders(<Payments />);

    const searchInput = screen.getByPlaceholderText('Payment ID, Entity...');
    fireEvent.change(searchInput, { target: { value: 'PAY-2026' } });

    await waitFor(() => {
      expect(api.getPayments).toHaveBeenCalledWith(expect.objectContaining({
        search: 'PAY-2026'
      }));
    });
  });

  it('displays empty state when no payments match', async () => {
    vi.mocked(api.getPayments).mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });

    renderWithProviders(<Payments />);

    await waitFor(() => {
      expect(screen.getByText('No payments found')).toBeInTheDocument();
    });
  });
});
