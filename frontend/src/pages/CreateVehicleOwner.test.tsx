import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateVehicleOwner from './CreateVehicleOwner';
import * as api from '../services/api';

vi.mock('../services/api');

const queryClient = new QueryClient();

describe('CreateVehicleOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form inputs', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreateVehicleOwner />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mobile Number' })).toBeInTheDocument();
  });

  it('submits the form', async () => {
    vi.mocked(api.createVehicleOwner).mockResolvedValue({ success: true, data: {} as any });
    
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreateVehicleOwner />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'New Owner' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile Number' }), { target: { value: '9999999999' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Vehicle Owner/i }));

    await waitFor(() => {
      expect(api.createVehicleOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Owner',
          mobile_number: '9999999999',
        }),
        expect.anything()
      );
    });
  });
});
