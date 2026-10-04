import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { GlobalSearchModal } from './GlobalSearchModal';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('GlobalSearchModal', () => {
  const mockOnClose = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  const renderModal = (isOpen = true) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GlobalSearchModal isOpen={isOpen} onClose={mockOnClose} />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders initial state when opened', () => {
    renderModal();
    expect(screen.getByTestId('global-search-input')).toBeInTheDocument();
    expect(screen.getByText('Type to start searching...')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = renderModal(false);
    expect(container).toBeEmptyDOMElement();
  });

  it('displays loading state during search and handles results', async () => {
    const mockData = {
      trips: [
        { id: '1', title: 'Trip to Delhi', amount: 5000, status: 'PENDING' }
      ],
      parties: [],
      vehicles: [],
      owners: [],
      bills: [],
      payments: []
    };
    
    (api.get as any).mockResolvedValueOnce({ data: mockData });

    renderModal();
    
    const input = screen.getByTestId('global-search-input');
    await userEvent.type(input, 'Delhi');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/search', { params: { q: 'Delhi' } });
    });

    // Should show results
    await waitFor(() => {
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    expect(screen.getByText('Trips')).toBeInTheDocument();
    expect(screen.getByText('Trip to Delhi')).toBeInTheDocument();
    expect(screen.getByText('₹5,000.00')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();

    // Test clicking a result
    const resultItem = screen.getByTestId('result-item-trips-1');
    await userEvent.click(resultItem);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trips/1');
  });

  it('displays empty state when no results found', async () => {
    const mockData = {
      trips: [],
      parties: [],
      vehicles: [],
      owners: [],
      bills: [],
      payments: []
    };
    
    (api.get as any).mockResolvedValue({ data: mockData });

    renderModal();
    
    const input = screen.getByTestId('global-search-input');
    await userEvent.type(input, 'Nonexistent');

    await waitFor(() => {
      expect(screen.getByTestId('search-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No results found for "Nonexistent"')).toBeInTheDocument();
  });

  it('displays error state on api failure', async () => {
    (api.get as any).mockRejectedValue(new Error('API Error'));

    renderModal();
    
    const input = screen.getByTestId('global-search-input');
    await userEvent.type(input, 'ErrorQuery');

    await waitFor(() => {
      expect(screen.getByTestId('search-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Error loading search results. Please try again.')).toBeInTheDocument();
  });

  it('closes on Escape key press', async () => {
    renderModal();
    
    const input = screen.getByTestId('global-search-input');
    await userEvent.type(input, '{Escape}');
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});
