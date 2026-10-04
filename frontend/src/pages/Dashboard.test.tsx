
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from './Dashboard';
import api from '../services/api';

// Mock the API module
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
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
        <DashboardPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders loading state initially', () => {
    // Return a never-resolving promise to simulate loading
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    
    renderComponent();
    expect(screen.getByText(/Loading dashboard.../i)).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'));
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText(/Error loading dashboard data:/i)).toBeInTheDocument();
    });
  });

  it('renders dashboard data successfully', async () => {
    const mockData = {
      data: {
        status: 'success',
        data: {
          header: {
            user: { id: '1', name: 'Test User', role: 'OWNER' },
          },
          businessSnapshot: {
            totalTrips: 15,
            ownFleetTrips: 5,
            financialSummary: {
              totalIncoming: 50000,
              totalOutgoing: 20000,
              netPnl: 30000,
            },
          },
          needsAttention: {
            pendingPodTrips: 3,
            unpaidBills: 2,
          },
          recentTrips: [
            { id: 't1', trip_number: 'TRP-001', trip_date: '2023-10-01T00:00:00Z', status: 'COMPLETED' },
          ],
          recentPayments: [
            { id: 'p1', payment_date: '2023-10-02T00:00:00Z', payment_type: 'ADVANCE', amount: 5000, payment_status: 'ACTIVE', payment_mode: 'UPI' },
          ],
        }
      }
    };

    vi.mocked(api.get).mockResolvedValue(mockData);

    renderComponent();

    // Check Business Snapshot
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument(); // Total Trips
    });
    
    // Check Amounts (they might be formatted)
    // 50000 -> ₹50,000.00
    // We can just verify the amounts contain the numeric parts
    expect(screen.getByText(/50,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/20,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/30,000\.00/)).toBeInTheDocument();

    // Check Needs Attention
    expect(screen.getByText('3')).toBeInTheDocument(); // Pending PODs
    expect(screen.getByText('2')).toBeInTheDocument(); // Unpaid Bills

    // Check Own Fleet
    expect(screen.getByText('5')).toBeInTheDocument();

    // Check Recent Trips
    expect(screen.getByText('TRP-001')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();

    // Check Recent Payments
    expect(screen.getByText('ADVANCE')).toBeInTheDocument();
    expect(screen.getByText(/5,000\.00/)).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });
});
