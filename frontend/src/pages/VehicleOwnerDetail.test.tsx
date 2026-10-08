import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VehicleOwnerDetail from './VehicleOwnerDetail';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('VehicleOwnerDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: '1', name: 'Test', email: 't@t.com', role: 'OWNER' } });
  });

  it('renders owner details and financials', async () => {
    vi.mocked(api.getVehicleOwner).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        name: 'John Owner',
        mobile_number: '9999999999',
        created_at: '',
        updated_at: '',
      },
    });
    vi.mocked(api.getVehicleOwnerFinancials).mockResolvedValue({
      success: true,
      data: {
        total_payable: 5000,
        amount_paid: 2000,
        outstanding: 3000,
      }
    });
    vi.mocked(api.getVehicleOwnerVehicles).mockResolvedValue({
      success: true,
      data: [{ id: '1', vehicle_number: 'RJ14TE1234', vehicle_type: 'Truck' }]
    });
    vi.mocked(api.getVehicleOwnerTrips).mockResolvedValue({
      success: true,
      data: []
    });
    vi.mocked(api.getVehicleOwnerPayments).mockResolvedValue({
      success: true,
      data: []
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/vehicle-owners/1']}>
          <Routes>
            <Route path="/vehicle-owners/:id" element={<VehicleOwnerDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('John Owner')).toBeInTheDocument();
      expect(screen.getByText('₹5000')).toBeInTheDocument(); // total payable
      expect(screen.getByText('₹2000')).toBeInTheDocument(); // amount paid
      expect(screen.getByText('₹3000')).toBeInTheDocument(); // outstanding
      expect(screen.getByText('RJ14TE1234')).toBeInTheDocument(); // vehicle
    });
  });

  it('hides edit button for CA role', async () => {
    useAuthStore.setState({ user: { id: '2', name: 'CA', email: 'c@c.com', role: 'CA' } });
    
    vi.mocked(api.getVehicleOwner).mockResolvedValue({
      success: true,
      data: { id: '1', name: 'John Owner', mobile_number: '9999999999', created_at: '', updated_at: '' },
    });
    vi.mocked(api.getVehicleOwnerFinancials).mockResolvedValue({ success: true, data: {} });
    vi.mocked(api.getVehicleOwnerVehicles).mockResolvedValue({ success: true, data: [] });
    vi.mocked(api.getVehicleOwnerTrips).mockResolvedValue({ success: true, data: [] });
    vi.mocked(api.getVehicleOwnerPayments).mockResolvedValue({ success: true, data: [] });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/vehicle-owners/1']}>
          <Routes>
            <Route path="/vehicle-owners/:id" element={<VehicleOwnerDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('John Owner')).toBeInTheDocument();
      expect(screen.queryByText('Edit Owner')).not.toBeInTheDocument();
    });
  });
});
