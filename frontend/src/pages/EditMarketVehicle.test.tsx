import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditMarketVehicle from './EditMarketVehicle';
import { getMarketVehicle, getVehicleOwners } from '../services/api';

vi.mock('../services/api', () => ({
  getMarketVehicle: vi.fn(),
  getVehicleOwners: vi.fn(),
  updateMarketVehicle: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/market-vehicles/1/edit']}>
        <Routes>
          <Route path="/market-vehicles/:id/edit" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('EditMarketVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders form with existing data', async () => {
    vi.mocked(getMarketVehicle).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        vehicle_number: 'RJ01AA1111',
        vehicle_type: 'Truck',
        vehicle_owner_id: 'owner1',
        owner_name: 'John',
        owner_mobile_number: '123'
      },
    });
    vi.mocked(getVehicleOwners).mockResolvedValue({
      success: true,
      data: [{ id: 'owner1', name: 'John Doe', mobile_number: '1234567890', created_at: '', updated_at: '' }],
    });

    renderWithProviders(<EditMarketVehicle />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('RJ01AA1111')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Truck')).toBeInTheDocument();
    });
  });
});
