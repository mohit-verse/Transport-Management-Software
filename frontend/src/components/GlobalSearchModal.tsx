import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useDebounce } from '../hooks/useDebounce';
import { AmountDisplay } from './AmountDisplay';
import { StatusBadge, type StatusType } from './StatusBadge';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  amount?: number;
  status?: string;
}

interface SearchResponse {
  trips?: SearchResultItem[];
  parties?: SearchResultItem[];
  vehicles?: SearchResultItem[];
  owners?: SearchResultItem[];
  bills?: SearchResultItem[];
  payments?: SearchResultItem[];
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const mapStatusToType = (status: string): StatusType => {
  const s = status.toLowerCase();
  if (['completed', 'paid', 'success', 'active'].includes(s)) return 'success';
  if (['pending', 'processing', 'warning'].includes(s)) return 'warning';
  if (['error', 'failed', 'cancelled', 'overdue'].includes(s)) return 'error';
  return 'default';
};

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return null;
      const response = await api.get<SearchResponse>('/api/search', { params: { q: debouncedQuery } });
      return response.data;
    },
    enabled: debouncedQuery.length > 0,
  });

  if (!isOpen) return null;

  const handleResultClick = (type: string, id: string) => {
    handleClose();
    navigate(`/${type}/${id}`);
  };

  const categories = [
    { key: 'trips', label: 'Trips', path: 'trips' },
    { key: 'parties', label: 'Parties', path: 'parties' },
    { key: 'vehicles', label: 'Vehicles', path: 'vehicles' },
    { key: 'owners', label: 'Owners', path: 'owners' },
    { key: 'bills', label: 'Bills', path: 'bills' },
    { key: 'payments', label: 'Payments', path: 'payments' },
  ] as const;

  const hasResults = data && categories.some((c) => data[c.key] && data[c.key]!.length > 0);
  const isInitial = !debouncedQuery;
  const isSearchEmpty = !isInitial && !isLoading && !isError && !hasResults;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-gray-900/50 backdrop-blur-sm">
      <div 
        className="fixed inset-0"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="relative z-50 w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh] mx-4">
        {/* Search Input Header */}
        <div className="flex items-center px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 px-3 py-2 text-base bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-gray-400 text-gray-900"
            placeholder="Search trips, parties, vehicles..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="global-search-input"
          />
          <button
            onClick={handleClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {isInitial && (
            <div className="flex flex-col items-center justify-center h-full pt-16 text-gray-500">
              <Search className="w-12 h-12 text-gray-300 mb-4" />
              <p>Type to start searching...</p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full pt-16 text-gray-500">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" data-testid="search-loading" />
              <p>Searching...</p>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center h-full pt-16 text-red-500" data-testid="search-error">
              <p>Error loading search results. Please try again.</p>
            </div>
          )}

          {isSearchEmpty && (
            <div className="flex flex-col items-center justify-center h-full pt-16 text-gray-500" data-testid="search-empty">
              <p>No results found for "{debouncedQuery}"</p>
            </div>
          )}

          {!isLoading && !isError && hasResults && (
            <div className="py-2" data-testid="search-results">
              {categories.map((category) => {
                const items = data[category.key];
                if (!items || items.length === 0) return null;

                return (
                  <div key={category.key} className="mb-4">
                    <div className="px-4 py-1 text-xs font-semibold tracking-wider text-gray-500 uppercase bg-gray-50">
                      {category.label}
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between transition-colors focus:outline-none focus:bg-gray-50"
                            onClick={() => handleResultClick(category.path, item.id)}
                            data-testid={`result-item-${category.key}-${item.id}`}
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {item.title}
                              </p>
                              {item.subtitle && (
                                <p className="text-sm text-gray-500 truncate">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {item.amount !== undefined && (
                                <AmountDisplay amount={item.amount} className="text-sm" />
                              )}
                              {item.status && (
                                <StatusBadge
                                  status={mapStatusToType(item.status)}
                                  label={item.status}
                                />
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
