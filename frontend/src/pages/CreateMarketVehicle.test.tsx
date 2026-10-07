import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CreateMarketVehicle from './CreateMarketVehicle';
import { getVehicleOwners } from '../services/api';

vi.mock('../services/api', () => ({
  getVehicleOwners: vi.fn(),
  createMarketVehicle: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('CreateMarketVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders form and owners list', async () => {
    vi.mocked(getVehicleOwners).mockResolvedValue({
      success: true,
      data: [{ id: 'owner1', name: 'John Doe', mobile_number: '1234567890', created_at: '', updated_at: '' }],
    });

    renderWithProviders(<CreateMarketVehicle />);

    await waitFor(() => {
      expect(screen.getByText('John Doe (1234567890)')).toBeInTheDocument();
    });
    
    expect(screen.getByLabelText(/Vehicle Number \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Vehicle Type/i)).toBeInTheDocument();
  });
});
