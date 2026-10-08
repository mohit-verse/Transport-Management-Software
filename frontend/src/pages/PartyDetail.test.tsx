import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PartyDetail from './PartyDetail';
import * as api from '../services/api';

vi.mock('../services/api');
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ role: 'OWNER' }))
}));

const renderWithProviders = (component: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/parties/1']}>
        <Routes>
          <Route path="/parties/:id" element={component} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('PartyDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders party details correctly', async () => {
    vi.mocked(api.getParty).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        name: 'ABC Corp',
        party_type: 'COMPANY',
        primary_mobile: '1234567890',
        is_tds_applicable: true,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      } as any
    });
    
    vi.mocked(api.getPartyFinancials).mockResolvedValue({
      success: true,
      data: { current_balance: 5000, total_billed: 10000, total_paid: 5000, outstanding: 5000, credit: 0, total_tds: 200 }
    });

    vi.mocked(api.getPartyTrips).mockResolvedValue({ success: true, data: [] });
    vi.mocked(api.getPartyBills).mockResolvedValue({ success: true, data: [] });
    vi.mocked(api.getPartyPayments).mockResolvedValue({ success: true, data: [] });

    renderWithProviders(<PartyDetail />);

    expect(await screen.findByText('ABC Corp')).toBeInTheDocument();
    expect(screen.getByText('Master Information')).toBeInTheDocument();
    expect(screen.getByText('Financial Position')).toBeInTheDocument();
    expect(screen.getByText('TDS Information')).toBeInTheDocument();
    expect(screen.getAllByText('₹5000').length).toBeGreaterThan(0);
  });
});
