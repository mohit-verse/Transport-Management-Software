import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreateTrip from './CreateTrip';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn(),
    patch: vi.fn(),
  }
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

describe('CreateTrip', () => {
  it('renders the form and submits correctly', async () => {
    (api.post as any).mockResolvedValueOnce({ data: { data: { id: 'new-trip-id' } } });
    (api.patch as any).mockResolvedValueOnce({ data: { success: true } });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CreateTrip />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('New Trip')).toBeInTheDocument();
    
    // Fill required fields
    fireEvent.change(screen.getByLabelText('Trip Type'), { target: { value: 'MARKET' } });
    fireEvent.change(screen.getByLabelText(/Party \/ Company \*/i), { target: { value: 'party-1' } });
    
    // Trip date is required
    const tripDateInputs = screen.getAllByLabelText(/Trip Date/i);
    fireEvent.change(tripDateInputs[0], { target: { value: '2026-10-10' } });

    fireEvent.change(screen.getByLabelText(/Primary Origin/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/Primary Destination/i), { target: { value: 'Delhi' } });
    
    const fromInputs = screen.getAllByLabelText(/From/i);
    fireEvent.change(fromInputs[0], { target: { value: 'Mumbai' } });
    
    const toInputs = screen.getAllByLabelText(/To/i);
    fireEvent.change(toInputs[0], { target: { value: 'Delhi' } });
    
    fireEvent.submit(screen.getByRole('button', { name: /Save Trip/i }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });
});
