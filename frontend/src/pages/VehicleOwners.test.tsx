import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VehicleOwners from './VehicleOwners';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('VehicleOwners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: '1', name: 'Test', email: 't@t.com', role: 'OWNER' } });
  });

  it('renders loading state initially', () => {
    vi.mocked(api.getVehicleOwners).mockReturnValue(new Promise(() => {}));
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <VehicleOwners />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Loading vehicle owners...')).toBeInTheDocument();
  });

  it('renders table data', async () => {
    vi.mocked(api.getVehicleOwners).mockResolvedValue({
      success: true,
      data: [
        {
          id: '1',
          name: 'John Doe',
          mobile_number: '1234567890',
          created_at: '',
          updated_at: '',
          vehicles: [{ vehicle_number: 'RJ14TE1234' }],
          outstanding: 500,
          total_payable: 1000,
          amount_paid: 200
        } as any
      ],
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <VehicleOwners />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('1234567890')).toBeInTheDocument();
      expect(screen.getByText('RJ14TE1234')).toBeInTheDocument();
      expect(screen.getByText('₹500')).toBeInTheDocument();
    });
  });

  it('hides add button for CA role', async () => {
    useAuthStore.setState({ user: { id: '2', name: 'CA', email: 'c@c.com', role: 'CA' } });
    vi.mocked(api.getVehicleOwners).mockResolvedValue({ success: true, data: [] });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <VehicleOwners />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Add Vehicle Owner')).not.toBeInTheDocument();
    });
  });
});
