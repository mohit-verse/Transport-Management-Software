import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BillingSettings from './BillingSettings';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

const mockTemplatesData = [
  {
    id: 'tpl-1',
    name: 'Standard Transport Invoice',
    template_type: 'CONSOLIDATED' as const,
    status: 'ACTIVE' as const,
    component_count: 8,
    asset_count: 2,
    dynamic_field_count: 12,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-10T10:00:00Z',
  },
  {
    id: 'tpl-2',
    name: 'Single Trip Bill Layout',
    template_type: 'INDIVIDUAL' as const,
    status: 'DRAFT' as const,
    component_count: 5,
    asset_count: 1,
    dynamic_field_count: 6,
    created_at: '2026-10-05T10:00:00Z',
    updated_at: '2026-10-08T10:00:00Z',
  },
];

describe('BillingSettings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'user-1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER' },
      token: 'test-token',
    });

    vi.mocked(api.getBillTemplates).mockResolvedValue({
      success: true,
      data: mockTemplatesData,
      pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
    });

    vi.mocked(api.getNumberingSeriesList).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'series-1',
          party_id: 'party-1',
          party_name: 'Ambuja Cements',
          financial_year_id: 'fy-1',
          financial_year_code: 'FY 2026-27',
          series_code: 'AMB',
          prefix: 'SRL/AMB/26-27/',
          current_number: 14,
          is_active: true,
        },
      ],
    });

    vi.mocked(api.getParties).mockResolvedValue({
      success: true,
      data: [{ id: 'party-1', name: 'Ambuja Cements', type: 'COMPANY' } as any],
    });

    vi.mocked(api.getFinancialYears).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'fy-1',
          code: 'FY 2026-27',
          start_date: '2026-04-01',
          end_date: '2027-03-31',
          is_active: true,
        },
      ],
    });
  });

  it('renders billing settings title, tabs, and template list for OWNER', async () => {
    renderWithProviders(<BillingSettings />);

    expect(screen.getByText('Billing Settings & Designer')).toBeInTheDocument();
    expect(screen.getByText('Bill Templates')).toBeInTheDocument();
    expect(screen.getByText('Numbering Series')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Standard Transport Invoice')).toBeInTheDocument();
      expect(screen.getByText('Single Trip Bill Layout')).toBeInTheDocument();
    });

    // Owner action buttons
    expect(screen.getByText('Create Template')).toBeInTheDocument();
    expect(screen.getByText('Import Reference')).toBeInTheDocument();
  });

  it('restricts actions for STAFF users to read-only view and preview', async () => {
    useAuthStore.setState({
      user: { id: 'user-2', name: 'Staff User', email: 'staff@example.com', role: 'STAFF' },
      token: 'test-token',
    });

    renderWithProviders(<BillingSettings />);

    await waitFor(() => {
      expect(screen.getByText('Standard Transport Invoice')).toBeInTheDocument();
    });

    // Operational mode notice displayed
    expect(screen.getByText(/Operational Mode: You have read-only access/i)).toBeInTheDocument();

    // Owner mutation buttons should not be rendered
    expect(screen.queryByText('Create Template')).not.toBeInTheDocument();
    expect(screen.queryByText('Import Reference')).not.toBeInTheDocument();
  });

  it('handles delete modal and displays historical template rejection message if 422 returned', async () => {
    vi.mocked(api.deleteBillTemplate).mockRejectedValueOnce({
      response: {
        status: 422,
        data: { message: 'Cannot delete template linked to historical bill versions' },
      },
    });

    renderWithProviders(<BillingSettings />);

    await waitFor(() => {
      expect(screen.getByText('Standard Transport Invoice')).toBeInTheDocument();
    });

    // Click delete button for first template
    const deleteButtons = screen.getAllByTitle('Delete Template');
    fireEvent.click(deleteButtons[0]);

    // Modal opens
    expect(screen.getByText('Delete Bill Template')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete template/i)).toBeInTheDocument();

    // Click Confirm Delete
    const confirmBtn = screen.getByText('Confirm Delete');
    fireEvent.click(confirmBtn);

    // Rejection message with historical preservation guidance
    await waitFor(() => {
      expect(screen.getByText(/Deletion Rejected by Server/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Cannot delete template linked to historical bill versions/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/To prevent visual regressions of issued bills/i)).toBeInTheDocument();
    });
  });

  it('switches to Numbering Series tab and renders numbering series manager', async () => {
    renderWithProviders(<BillingSettings />);

    const numberingTab = screen.getByRole('button', { name: /Numbering Series/i });
    fireEvent.click(numberingTab);

    await waitFor(() => {
      expect(screen.getByText('Numbering Series Configuration')).toBeInTheDocument();
      expect(screen.getByText('SRL/AMB/26-27/')).toBeInTheDocument();
    });
  });
});
