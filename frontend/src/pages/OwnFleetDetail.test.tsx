import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OwnFleetDetail from './OwnFleetDetail';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

import { MemoryRouter, Route, Routes } from 'react-router-dom';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/own-fleet/1']}>
        <Routes>
          <Route path="/own-fleet/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('OwnFleetDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
    useAuthStore.setState({ user: { id: '1', name: 'Test', email: 'test@example.com', role: 'OWNER' } });
  });

  it('renders vehicle details successfully', async () => {
    vi.mocked(api.getOwnFleetVehicle).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        vehicle_number: 'RJ14TE1234',
        vehicle_type: 'Truck',
        capacity_tonnage: 20,
        purchase_date: '2022-01-01',
        status: 'AVAILABLE',
        created_at: '2022-01-01',
        updated_at: '2022-01-01'
      }
    });
    vi.mocked(api.getOwnFleetTrips).mockResolvedValue({ success: true, data: [] });
    vi.mocked(api.getOwnFleetExpenses).mockResolvedValue({ success: true, data: [] });
    vi.mocked(api.getDocuments).mockResolvedValue({ success: true, data: [] });

    renderWithProviders(<OwnFleetDetail />);
    
    await waitFor(() => {
      expect(screen.getByText('RJ14TE1234')).toBeInTheDocument();
      expect(screen.getByText('Capacity:')).toBeInTheDocument();
      expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
    });
  });
});
