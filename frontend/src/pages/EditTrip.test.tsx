import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EditTrip from './EditTrip';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  }
}));

// Mock react-router-dom's useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useParams: () => ({ id: 'trip-123' }),
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

describe('EditTrip', () => {
  it('fetches trip and submits updates correctly', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/api/trips/trip-123')) {
        return Promise.resolve({
          data: {
            data: {
              id: 'trip-123',
              trip_type: 'MARKET',
              vehicle_relationship: 'MARKET',
              party_id: 'party-1',
              origin: 'Mumbai',
              destination: 'Pune',
              freight_amount: 5000,
              destinations: [{ id: 'dest-1', from_location: 'Mumbai', to_location: 'Pune', distance_km: 150 }]
            }
          }
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    (api.patch as any).mockResolvedValue({ data: { success: true } });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <EditTrip />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for the form to render
    await waitFor(() => {
      expect(screen.getAllByDisplayValue('Mumbai').length).toBeGreaterThan(0);
    });

    // Check that structural fields are disabled
    const tripTypeSelect = screen.getByLabelText('Trip Type');
    expect(tripTypeSelect).toBeDisabled();

    // Change a field
    fireEvent.change(screen.getByLabelText(/Primary Destination/i), { target: { value: 'Delhi' } });
    
    // Change a financial field
    fireEvent.change(screen.getByLabelText(/Freight Amount/i), { target: { value: '6000' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Trip/i }));

    await waitFor(() => {
      // Expect 2 patch calls: one for core, one for financials
      expect(api.patch).toHaveBeenCalledWith('/api/trips/trip-123', expect.objectContaining({
        destination: 'Delhi',
      }));
      expect(api.patch).toHaveBeenCalledWith('/api/trips/trip-123/financials', expect.objectContaining({
        freight_amount: 6000,
      }));
    });
  });
});
