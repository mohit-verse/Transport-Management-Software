import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Parties from './Parties';
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
      <MemoryRouter>{component}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Parties Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(api.getParties).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Parties />);
    expect(screen.getByText('Loading parties...')).toBeInTheDocument();
  });

  it('renders a list of parties', async () => {
    const mockParties = [
      {
        id: '1',
        party_type: 'COMPANY',
        name: 'Test Company',
        primary_mobile: '9876543210',
        is_tds_applicable: true,
        outstanding: 1000,
        credit: 0,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      }
    ];

    vi.mocked(api.getParties).mockResolvedValue({ success: true, data: mockParties as any });

    renderWithProviders(<Parties />);

    const partyName = await screen.findByText('Test Company');
    expect(partyName).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
    expect(screen.getByText('COMPANY')).toBeInTheDocument();
    expect(screen.getByText('₹1000')).toBeInTheDocument();
    expect(screen.getByText('₹0')).toBeInTheDocument();
  });

  it('shows error state if API fails', async () => {
    vi.mocked(api.getParties).mockRejectedValue(new Error('API Error'));
    renderWithProviders(<Parties />);
    expect(await screen.findByText('Error loading parties')).toBeInTheDocument();
  });
});
