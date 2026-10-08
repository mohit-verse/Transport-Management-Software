import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditVehicleOwner from './EditVehicleOwner';
import * as api from '../services/api';

vi.mock('../services/api');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('EditVehicleOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays owner data', async () => {
    vi.mocked(api.getVehicleOwner).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        name: 'Existing Owner',
        mobile_number: '8888888888',
        created_at: '',
        updated_at: '',
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/vehicle-owners/1/edit']}>
          <Routes>
            <Route path="/vehicle-owners/:id/edit" element={<EditVehicleOwner />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Owner')).toBeInTheDocument();
      expect(screen.getByDisplayValue('8888888888')).toBeInTheDocument();
    });
  });

  it('submits updated data', async () => {
    vi.mocked(api.getVehicleOwner).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        name: 'Existing Owner',
        mobile_number: '8888888888',
        created_at: '',
        updated_at: '',
      },
    });
    vi.mocked(api.updateVehicleOwner).mockResolvedValue({ success: true, data: {} as any });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/vehicle-owners/1/edit']}>
          <Routes>
            <Route path="/vehicle-owners/:id/edit" element={<EditVehicleOwner />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Owner')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Updated Owner' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(api.updateVehicleOwner).toHaveBeenCalledWith('1', expect.objectContaining({
        name: 'Updated Owner',
      }));
    });
  });
});
