import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateBill from './CreateBill';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mockParties = [
  {
    id: 'party-1',
    name: 'UltraTech Cement Ltd',
    party_type: 'COMPANY' as const,
    primary_mobile: '9876543210',
    is_tds_applicable: false,
    billing_configuration: { billing_mode: 'CONSOLIDATED' },
    created_at: '2026-01-01',
    updated_at: '2026-01-01'
  },
  {
    id: 'party-2',
    name: 'Shree Cement Ltd',
    party_type: 'COMPANY' as const,
    primary_mobile: '9876543212',
    is_tds_applicable: false,
    billing_configuration: { billing_mode: 'INDIVIDUAL' },
    created_at: '2026-01-01',
    updated_at: '2026-01-01'
  }
];

const mockEligibleTrips: api.EligibleTrip[] = [
  {
    id: 'trip-1',
    trip_number: 'TRIP-2026-0001',
    trip_date: '2026-10-01',
    vehicle_number: 'RJ14-GA-1234',
    vehicle_relationship: 'MARKET',
    status: 'COMPLETED',
    loading_date: '2026-10-01',
    unloading_date: '2026-10-04',
    route_origin: 'Jaipur',
    route_destination: 'Ahmedabad',
    freight_amount: 50000,
    receivable_amount: 50000,
    detention_amount: 0,
    pod_status: 'RECEIVED',
    pod_received_at: '2026-10-05T10:00:00Z'
  },
  {
    id: 'trip-2',
    trip_number: 'TRIP-2026-0002',
    trip_date: '2026-10-02',
    vehicle_number: 'RJ14-GB-5678',
    vehicle_relationship: 'OWN_FLEET',
    status: 'COMPLETED',
    loading_date: '2026-10-02',
    unloading_date: '2026-10-05',
    route_origin: 'Kotputli',
    route_destination: 'Surat',
    freight_amount: 60000,
    receivable_amount: 60000,
    detention_amount: 0,
    pod_status: 'RECEIVED',
    pod_received_at: '2026-10-06T10:00:00Z'
  }
];

const mockFinancialYears: api.FinancialYear[] = [
  {
    id: 'fy-1',
    code: 'FY 2026-2027',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
    is_active: true
  }
];

const mockSeries: api.NumberingSeries[] = [
  {
    id: 'series-1',
    party_id: 'party-1',
    financial_year_id: 'fy-1',
    series_code: 'STD',
    prefix: 'SRL/26-27/',
    current_number: 1,
    is_active: true
  }
];

describe('CreateBill Page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ user: { id: '1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER' } });

    vi.mocked(api.getParties).mockResolvedValue({
      success: true,
      data: mockParties
    });

    vi.mocked(api.getFinancialYears).mockResolvedValue({
      success: true,
      data: mockFinancialYears
    });

    vi.mocked(api.getNumberingSeries).mockResolvedValue({
      success: true,
      data: mockSeries
    });

    vi.mocked(api.getEligibleTrips).mockResolvedValue({
      success: true,
      data: mockEligibleTrips
    });
  });

  it('renders bill creation workflow steps and inputs', async () => {
    renderWithProviders(<CreateBill />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Generate New Bill' })).toBeInTheDocument();
      expect(screen.getByText('1. Select Party & Billing Mode')).toBeInTheDocument();
      expect(screen.getByText('2. Select Trips for Billing')).toBeInTheDocument();
      expect(screen.getByText('3. Document Series & Date')).toBeInTheDocument();
    });

    // Check party select has default option
    expect(screen.getByLabelText(/Billed Party/i)).toBeInTheDocument();
  });

  it('loads and selects eligible trips when party is chosen, calculating preview total', async () => {
    renderWithProviders(<CreateBill />);

    await waitFor(() => {
      expect(screen.getByText('UltraTech Cement Ltd (COMPANY)')).toBeInTheDocument();
    });

    const partySelect = screen.getByLabelText(/Billed Party/i);
    fireEvent.change(partySelect, { target: { value: 'party-1' } });

    await waitFor(() => {
      expect(api.getEligibleTrips).toHaveBeenCalledWith('party-1');
      expect(screen.getByText('TRIP-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('TRIP-2026-0002')).toBeInTheDocument();
    });

    // Select the first trip by clicking its checkbox
    const trip1Checkbox = screen.getByLabelText('Select trip TRIP-2026-0001');
    fireEvent.click(trip1Checkbox);

    // Verify preview total displays ₹50,000.00
    await waitFor(() => {
      expect(screen.getByText('Subtotal Receivable:')).toBeInTheDocument();
      expect(screen.getAllByText(/50,000/).length).toBeGreaterThan(0);
    });

    // Select the second trip
    const trip2Checkbox = screen.getByLabelText('Select trip TRIP-2026-0002');
    fireEvent.click(trip2Checkbox);

    // Verify preview total displays ₹1,10,000.00
    await waitFor(() => {
      expect(screen.getAllByText(/1,10,000/).length).toBeGreaterThan(0);
    });
  });

  it('handles INDIVIDUAL billing mode allowing only 1 trip selection', async () => {
    renderWithProviders(<CreateBill />);

    await waitFor(() => {
      expect(screen.getByText('Shree Cement Ltd (COMPANY)')).toBeInTheDocument();
    });

    const partySelect = screen.getByLabelText(/Billed Party/i);
    fireEvent.change(partySelect, { target: { value: 'party-2' } });

    await waitFor(() => {
      expect(screen.getByText('TRIP-2026-0001')).toBeInTheDocument();
    });

    // Select trip 1
    const trip1Checkbox = screen.getByLabelText('Select trip TRIP-2026-0001');
    fireEvent.click(trip1Checkbox);

    await waitFor(() => {
      expect(screen.getAllByText(/50,000/).length).toBeGreaterThan(0);
    });

    // Select trip 2 -> should replace trip 1 in INDIVIDUAL mode
    const trip2Checkbox = screen.getByLabelText('Select trip TRIP-2026-0002');
    fireEvent.click(trip2Checkbox);

    await waitFor(() => {
      expect(screen.getAllByText(/60,000/).length).toBeGreaterThan(0);
    });
  });

  it('submits bill generation successfully with valid inputs', async () => {
    vi.mocked(api.generateBill).mockResolvedValue({
      success: true,
      data: {
        bill: {
          id: 'new-bill-1',
          bill_number: 'SRL/26-27/001'
        },
        version: {
          id: 'new-ver-1',
          version_number: 1
        }
      }
    });

    renderWithProviders(<CreateBill />);

    await waitFor(() => {
      expect(screen.getByText('UltraTech Cement Ltd (COMPANY)')).toBeInTheDocument();
    });

    // 1. Select Party
    const partySelect = screen.getByLabelText(/Billed Party/i);
    fireEvent.change(partySelect, { target: { value: 'party-1' } });

    await waitFor(() => {
      expect(screen.getByText('TRIP-2026-0001')).toBeInTheDocument();
    });

    // 2. Select Trips (Select All button)
    const selectAllBtn = screen.getByRole('button', { name: 'Select All' });
    fireEvent.click(selectAllBtn);

    // 3. Submit
    const generateBtn = screen.getByRole('button', { name: 'Generate Bill' });
    expect(generateBtn).not.toBeDisabled();
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.generateBill).toHaveBeenCalledWith({
        party_id: 'party-1',
        billing_mode: 'CONSOLIDATED',
        trip_ids: ['trip-1', 'trip-2'],
        financial_year_id: 'fy-1',
        numbering_series_id: 'series-1',
        template_snapshot: {},
        bill_date: expect.any(String)
      });
    });
  });

  it('displays error when bill generation fails', async () => {
    vi.mocked(api.generateBill).mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'One or more trips are already billed on an active bill.'
          }
        }
      }
    });

    renderWithProviders(<CreateBill />);

    await waitFor(() => {
      expect(screen.getByText('UltraTech Cement Ltd (COMPANY)')).toBeInTheDocument();
    });

    const partySelect = screen.getByLabelText(/Billed Party/i);
    fireEvent.change(partySelect, { target: { value: 'party-1' } });

    await waitFor(() => {
      expect(screen.getByText('TRIP-2026-0001')).toBeInTheDocument();
    });

    const selectAllBtn = screen.getByRole('button', { name: 'Select All' });
    fireEvent.click(selectAllBtn);

    const generateBtn = screen.getByRole('button', { name: 'Generate Bill' });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('One or more trips are already billed on an active bill.')).toBeInTheDocument();
    });
  });
});
