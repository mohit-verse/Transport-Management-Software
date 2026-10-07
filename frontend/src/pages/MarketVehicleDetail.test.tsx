import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MarketVehicleDetail from './MarketVehicleDetail';
import { getMarketVehicle } from '../services/api';

vi.mock('../services/api', () => ({
  getMarketVehicle: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/market-vehicles/1']}>
        <Routes>
          <Route path="/market-vehicles/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MarketVehicleDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders vehicle details and trips', async () => {
    vi.mocked(getMarketVehicle).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        vehicle_number: 'RJ01AA1111',
        vehicle_type: 'Truck',
        vehicle_owner_id: 'owner1',
        owner_name: 'John Doe',
        owner_mobile_number: '1234567890',
        trips: [
          {
            id: 'trip1',
            trip_number: 'TRP001',
            trip_date: '2026-10-01T00:00:00.000Z',
            origin: 'Jaipur',
            destination: 'Delhi',
            status: 'COMPLETED'
          }
        ]
      },
    });

    renderWithProviders(<MarketVehicleDetail />);

    await waitFor(() => {
      expect(screen.getByText('RJ01AA1111')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('1234567890')).toBeInTheDocument();
      expect(screen.getByText('TRP001')).toBeInTheDocument();
      expect(screen.getByText('Jaipur → Delhi')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });
});
