import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Bills from './Bills';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mockBillsData = [
  {
    id: 'bill-1',
    bill_number: 'SRL/26-27/001',
    party_id: 'party-1',
    party_name: 'UltraTech Cement Ltd',
    financial_year_id: 'fy-1',
    fy_name: 'FY 2026-2027',
    financial_year_code: 'FY 2026-2027',
    billing_mode: 'CONSOLIDATED' as const,
    bill_date: '2026-10-10',
    bill_status: 'GENERATED' as const,
    total_amount: 150000,
    paid_amount: 0,
    balance_amount: 150000,
    current_version: 1,
    trip_count: 3,
    submitted_at: null,
    cancelled_at: null,
    cancel_reason: null,
    created_at: '2026-10-10T10:00:00Z',
    updated_at: '2026-10-10T10:00:00Z'
  },
  {
    id: 'bill-2',
    bill_number: 'SRL/26-27/002',
    party_id: 'party-2',
    party_name: 'Ambuja Cements',
    financial_year_id: 'fy-1',
    fy_name: 'FY 2026-2027',
    financial_year_code: 'FY 2026-2027',
    billing_mode: 'INDIVIDUAL' as const,
    bill_date: '2026-10-11',
    bill_status: 'PAID' as const,
    total_amount: 85000,
    paid_amount: 85000,
    balance_amount: 0,
    current_version: 2,
    trip_count: 1,
    submitted_at: '2026-10-11T11:00:00Z',
    cancelled_at: null,
    cancel_reason: null,
    created_at: '2026-10-11T10:00:00Z',
    updated_at: '2026-10-11T12:00:00Z'
  }
];

describe('Bills List Page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ user: { id: '1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER' } });

    vi.mocked(api.getParties).mockResolvedValue({
      success: true,
      data: [
        { id: 'party-1', name: 'UltraTech Cement Ltd', party_type: 'COMPANY', primary_mobile: '9876543210', is_tds_applicable: false, created_at: '2026-01-01', updated_at: '2026-01-01' },
        { id: 'party-2', name: 'Ambuja Cements', party_type: 'COMPANY', primary_mobile: '9876543211', is_tds_applicable: false, created_at: '2026-01-01', updated_at: '2026-01-01' }
      ]
    });

    vi.mocked(api.getFinancialYears).mockResolvedValue({
      success: true,
      data: [
        { id: 'fy-1', code: 'FY 2026-2027', start_date: '2026-04-01', end_date: '2027-03-31', is_active: true }
      ]
    });
  });

  it('renders bills list with columns, amounts, and badges', async () => {
    vi.mocked(api.getBills).mockResolvedValue({
      success: true,
      data: mockBillsData,
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1
      }
    });

    renderWithProviders(<Bills />);

    await waitFor(() => {
      expect(screen.getAllByText('SRL/26-27/001')[0]).toBeInTheDocument();
      expect(screen.getAllByText('SRL/26-27/002')[0]).toBeInTheDocument();
      expect(screen.getAllByText('UltraTech Cement Ltd')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Ambuja Cements')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Generated')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Paid')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Consolidated')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Individual')[0]).toBeInTheDocument();
    });

    // Check Create Bill button is visible for OWNER
    expect(screen.getByText('Create Bill')).toBeInTheDocument();
  });

  it('shows Create Bill button for STAFF role', async () => {
    useAuthStore.setState({ user: { id: '2', name: 'Staff User', email: 'staff@example.com', role: 'STAFF' } });

    vi.mocked(api.getBills).mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });

    renderWithProviders(<Bills />);

    await waitFor(() => {
      expect(screen.getByText('Create Bill')).toBeInTheDocument();
    });
  });

  it('hides Create Bill button for CA role', async () => {
    useAuthStore.setState({ user: { id: '3', name: 'CA User', email: 'ca@example.com', role: 'CA' } });

    vi.mocked(api.getBills).mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });

    renderWithProviders(<Bills />);

    await waitFor(() => {
      expect(screen.queryByText('Create Bill')).not.toBeInTheDocument();
    });
  });

  it('handles search and filtering triggers', async () => {
    vi.mocked(api.getBills).mockResolvedValue({
      success: true,
      data: mockBillsData,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }
    });

    renderWithProviders(<Bills />);

    await waitFor(() => {
      expect(screen.getAllByText('SRL/26-27/001')[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Bill No, Party Name...');
    fireEvent.change(searchInput, { target: { value: '001' } });

    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'GENERATED' } });

    const modeSelect = screen.getByLabelText('Billing Mode');
    fireEvent.change(modeSelect, { target: { value: 'CONSOLIDATED' } });

    // Reset filters
    const resetBtn = screen.getByRole('button', { name: 'Reset all filters' });
    fireEvent.click(resetBtn);

    expect((screen.getByPlaceholderText('Bill No, Party Name...') as HTMLInputElement).value).toBe('');
  });

  it('renders empty state when no bills found', async () => {
    vi.mocked(api.getBills).mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });

    renderWithProviders(<Bills />);

    await waitFor(() => {
      expect(screen.getByText('No bills found')).toBeInTheDocument();
      expect(screen.getByText('No bills match your current filter criteria or none have been generated yet.')).toBeInTheDocument();
    });
  });
});
