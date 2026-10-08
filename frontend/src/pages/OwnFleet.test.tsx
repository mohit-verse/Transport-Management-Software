import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OwnFleet from './OwnFleet';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('OwnFleet', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
    useAuthStore.setState({ user: { id: '1', name: 'Test', email: 'test@example.com', role: 'OWNER' } });
  });

  it('renders loading state initially', () => {
    vi.mocked(api.getOwnFleetVehicles).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OwnFleet />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders list of own fleet vehicles', async () => {
    vi.mocked(api.getOwnFleetVehicles).mockResolvedValue({
      success: true,
      data: [
        {
          id: '1',
          vehicle_number: 'RJ14TE1234',
          vehicle_type: 'Truck',
          capacity_tonnage: 20,
          purchase_date: '2022-01-01',
          status: 'AVAILABLE',
          created_at: '2022-01-01',
          updated_at: '2022-01-01'
        }
      ]
    });

    renderWithProviders(<OwnFleet />);
    
    await waitFor(() => {
      expect(screen.getByText('RJ14TE1234')).toBeInTheDocument();
      expect(screen.getByText('Truck')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
    });
  });

  it('renders empty state when no vehicles', async () => {
    vi.mocked(api.getOwnFleetVehicles).mockResolvedValue({ success: true, data: [] });
    renderWithProviders(<OwnFleet />);
    
    await waitFor(() => {
      expect(screen.getByText('No own fleet vehicles found.')).toBeInTheDocument();
    });
  });
});
