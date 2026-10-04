import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import TripsPage from './Trips';
import api from '../services/api';

// Mock the API module
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock useAuthStore to avoid auth context issues in testing
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ role: 'OWNER', name: 'Test User' })),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderComponent = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TripsPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('TripsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders loading state initially', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    
    renderComponent();
    expect(screen.getByText(/Loading trips.../i)).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'));
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText(/Error loading trips./i)).toBeInTheDocument();
    });
  });

  it('renders empty state correctly', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        status: 'success',
        data: []
      }
    });

    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText(/No trips found/i)).toBeInTheDocument();
    });
  });

  it('renders trips data successfully', async () => {
    const mockData = {
      data: {
        status: 'success',
        data: [
          {
            id: 't1',
            trip_number: 'TRP-1001',
            vehicle_number: 'RJ-14-GH-1122',
            driver_mobile: '9876543210',
            route_from: 'Jaipur',
            route_to: 'Delhi',
            loading_date: '2023-10-01T00:00:00Z',
            unloading_date: null,
            trip_status: 'IN_TRANSIT'
          },
          {
            id: 't2',
            trip_number: 'TRP-1002',
            vehicle_number: 'RJ-14-GH-3344',
            driver_mobile: '9876543211',
            route_from: 'Mumbai',
            route_to: 'Pune',
            loading_date: '2023-10-02T00:00:00Z',
            unloading_date: '2023-10-03T00:00:00Z',
            trip_status: 'COMPLETED'
          }
        ]
      }
    };

    vi.mocked(api.get).mockResolvedValue(mockData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('TRP-1001')[0]).toBeInTheDocument();
    });
    
    expect(screen.getAllByText('RJ-14-GH-1122')[0]).toBeInTheDocument();
    expect(screen.getAllByText('9876543210')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Jaipur')[0]).toBeInTheDocument();
    expect(screen.getAllByText('In Transit')[0]).toBeInTheDocument();

    expect(screen.getAllByText('TRP-1002')[0]).toBeInTheDocument();
    expect(screen.getAllByText('RJ-14-GH-3344')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Completed')[0]).toBeInTheDocument();
  });
});
