import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MarketVehicles from './MarketVehicles';
import { getMarketVehicles } from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api', () => ({
  getMarketVehicles: vi.fn(),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MarketVehicles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders loading state initially', () => {
    (useAuthStore as any).mockReturnValue({ user: { role: 'OWNER' } });
    vi.mocked(getMarketVehicles).mockReturnValue(new Promise(() => {}));
    
    renderWithProviders(<MarketVehicles />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders list of vehicles for OWNER', async () => {
    (useAuthStore as any).mockReturnValue({ user: { role: 'OWNER' } });
    vi.mocked(getMarketVehicles).mockResolvedValue({
      success: true,
      data: [
        {
          id: '1',
          vehicle_number: 'RJ01AA1111',
          vehicle_type: 'Truck',
          vehicle_owner_id: 'owner1',
          owner_name: 'John Doe',
          owner_mobile_number: '1234567890',
        },
      ],
    });

    renderWithProviders(<MarketVehicles />);

    await waitFor(() => {
      expect(screen.getByText('RJ01AA1111')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('1234567890')).toBeInTheDocument();
    });
    
    // Check for add button
    expect(screen.getByText('Add Market Vehicle')).toBeInTheDocument();
  });

  it('renders list of vehicles for CA but hides add button', async () => {
    (useAuthStore as any).mockReturnValue({ user: { role: 'CA' } });
    vi.mocked(getMarketVehicles).mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<MarketVehicles />);

    await waitFor(() => {
      expect(screen.getByText('No market vehicles found.')).toBeInTheDocument();
    });
    
    // Check no add button
    expect(screen.queryByText('Add Market Vehicle')).not.toBeInTheDocument();
  });
});
