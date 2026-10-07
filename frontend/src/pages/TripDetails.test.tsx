import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TripDetails from './TripDetails';
import api from '../services/api';

vi.mock('../services/api');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/trips/123']}>
        <Routes>
          <Route path="/trips/:id" element={component} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('TripDetails Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders loading state initially', () => {
    // Provide a promise that doesn't resolve immediately
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    
    renderWithProviders(<TripDetails />);
    expect(screen.getByText(/Loading trip details.../i)).toBeInTheDocument();
  });

  it('renders trip details successfully', async () => {
    const mockTripData = {
      data: {
        success: true,
        data: {
          id: '123',
          trip_id: 'TRP-123',
          trip_status: 'IN_TRANSIT',
          origin: 'Mumbai',
          destination: 'Delhi',
          party: { id: 'p1', name: 'Acme Corp' },
          financials: {
            party: { freight_amount: 50000, total_amount: 50000 },
          },
          destinations: [
            { id: 'd1', sequence_no: 1, from_location: 'Mumbai', to_location: 'Pune', distance_km: 150 }
          ],
          documents: [
            { id: 'doc1', file_name: 'invoice.pdf', document_type: 'INVOICE' }
          ]
        }
      }
    };
    
    vi.mocked(api.get).mockResolvedValue(mockTripData);
    
    renderWithProviders(<TripDetails />);
    
    await waitFor(() => {
      expect(screen.getByText('Trip TRP-123')).toBeInTheDocument();
    });
    
    expect(screen.getByText('IN_TRANSIT')).toBeInTheDocument();
    expect(screen.getAllByText('Mumbai').length).toBeGreaterThan(0);
    expect(screen.getByText('Delhi')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getAllByText('50000').length).toBeGreaterThan(0); // freight
    expect(screen.getByText('Pune')).toBeInTheDocument(); // destination to
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('API failed'));
    
    renderWithProviders(<TripDetails />);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load trip details/i)).toBeInTheDocument();
    });
  });
});
