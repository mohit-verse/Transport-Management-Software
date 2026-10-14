import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Documents from './Documents';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: React.ReactElement, client = createTestQueryClient()) => {
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

const mockDocs: api.DocumentItem[] = [
  {
    id: 'doc-1',
    document_type: 'POD',
    original_name: 'trip_pod_signed.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 1048576, // 1 MB
    expiry_date: null,
    uploaded_at: '2026-10-10T10:00:00Z',
    uploaded_by: 'user-1',
    uploaded_by_name: 'Ramesh Staff',
    entity_type: 'TRIP',
    entity_id: 'trip-101',
    entity_reference: 'TR-2026-001',
    expiry_status: null,
    days_to_expiry: null,
  },
  {
    id: 'doc-2',
    document_type: 'FITNESS',
    original_name: 'vehicle_fitness_cert.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 524288, // 512 KB
    expiry_date: '2026-10-01',
    uploaded_at: '2026-09-01T10:00:00Z',
    uploaded_by: 'user-2',
    uploaded_by_name: 'Sunil Owner',
    entity_type: 'OWN_FLEET_VEHICLE',
    entity_id: 'ofv-201',
    entity_reference: 'RJ14-GA-1234',
    expiry_status: 'EXPIRED',
    days_to_expiry: -13,
  },
  {
    id: 'doc-3',
    document_type: 'INSURANCE',
    original_name: 'insurance_policy.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 2097152, // 2 MB
    expiry_date: '2026-10-25',
    uploaded_at: '2026-09-15T10:00:00Z',
    uploaded_by: 'user-2',
    uploaded_by_name: 'Sunil Owner',
    entity_type: 'OWN_FLEET_VEHICLE',
    entity_id: 'ofv-201',
    entity_reference: 'RJ14-GA-1234',
    expiry_status: 'EXPIRING_SOON',
    days_to_expiry: 11,
  },
  {
    id: 'doc-4',
    document_type: 'PAYMENT_RECEIPT',
    original_name: 'bank_transfer_receipt.jpg',
    mime_type: 'image/jpeg',
    file_size_bytes: 307200, // 300 KB
    expiry_date: null,
    uploaded_at: '2026-10-12T10:00:00Z',
    uploaded_by: 'user-1',
    uploaded_by_name: 'Ramesh Staff',
    entity_type: 'PAYMENT',
    entity_id: 'pay-301',
    entity_reference: 'PAY-2627-0042',
    expiry_status: null,
    days_to_expiry: null,
  },
];

describe('Documents & Storage Management Page (Phase 4N)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({
      user: { id: 'user-2', name: 'Sunil Owner', email: 'owner@ssrl.com', role: 'OWNER' },
      token: 'fake-jwt',
    });
    vi.mocked(api.getDocuments).mockResolvedValue({ success: true, data: mockDocs });
  });

  it('renders loading state initially', () => {
    vi.mocked(api.getDocuments).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Documents />);
    expect(screen.getByText('Loading documents...')).toBeInTheDocument();
  });

  it('renders document index table with joined references, sizes, and expiry statuses', async () => {
    renderWithProviders(<Documents />);

    await waitFor(() => {
      expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
    });

    expect(screen.getByText('trip_pod_signed.pdf')).toBeInTheDocument();
    expect(screen.getByText('vehicle_fitness_cert.pdf')).toBeInTheDocument();
    expect(screen.getByText('insurance_policy.pdf')).toBeInTheDocument();
    expect(screen.getByText('bank_transfer_receipt.jpg')).toBeInTheDocument();

    // Check entity references and links
    expect(screen.getByText('TR-2026-001')).toBeInTheDocument();
    expect(screen.getAllByText('RJ14-GA-1234').length).toBeGreaterThan(0);
    expect(screen.getByText('PAY-2627-0042')).toBeInTheDocument();

    // Check expiry statuses
    expect(screen.getAllByText('Expired').length).toBeGreaterThan(0);
    expect(screen.getByText('11d left')).toBeInTheDocument();
    expect(screen.getAllByText('No Expiry').length).toBe(2);

    // Check size formatting
    expect(screen.getByText(/1.00 MB/)).toBeInTheDocument();
    expect(screen.getByText(/512.0 KB/)).toBeInTheDocument();
  });

  it('displays compliance expiry alert counts and allows quick filtering', async () => {
    renderWithProviders(<Documents />);

    await waitFor(() => {
      expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
    });

    expect(screen.getByText('Expired Fleet Documents')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);

    // Clicking Expired Fleet Documents card triggers filter
    const expiredCard = screen.getByText('Expired Fleet Documents').closest('div');
    fireEvent.click(expiredCard!);

    await waitFor(() => {
      expect(api.getDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ expiry_status: 'EXPIRED' })
      );
    });
  });

  it('supports search and filter controls', async () => {
    renderWithProviders(<Documents />);

    await waitFor(() => {
      expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search file, type, or entity...');
    fireEvent.change(searchInput, { target: { value: 'TR-2026' } });

    await waitFor(() => {
      expect(api.getDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'TR-2026' })
      );
    });

    // Filter by document type
    const typeSelect = screen.getByDisplayValue('All Document Types');
    fireEvent.change(typeSelect, { target: { value: 'POD' } });

    await waitFor(() => {
      expect(api.getDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ document_type: 'POD' })
      );
    });

    // Reset button appears when filtered
    const resetButton = screen.getByText('Reset');
    expect(resetButton).toBeInTheDocument();
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('All Document Types')).toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('grants OWNER full mutation access (Upload, Preview, Download, Replace, Delete)', async () => {
      useAuthStore.setState({
        user: { id: 'user-2', name: 'Sunil Owner', email: 'owner@ssrl.com', role: 'OWNER' },
        token: 'fake-jwt',
      });

      renderWithProviders(<Documents />);

      await waitFor(() => {
        expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
      });

      expect(screen.getByText('Upload Document')).toBeInTheDocument();
      expect(screen.getAllByTitle('Replace Document (Owner Authority)').length).toBe(4);
      expect(screen.getAllByTitle('Delete Document (Owner Authority)').length).toBe(4);
    });

    it('grants STAFF operational access (Upload, Preview, Download) but NO Replace or Delete', async () => {
      useAuthStore.setState({
        user: { id: 'user-1', name: 'Ramesh Staff', email: 'staff@ssrl.com', role: 'STAFF' },
        token: 'fake-jwt',
      });

      renderWithProviders(<Documents />);

      await waitFor(() => {
        expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
      });

      expect(screen.getByText('Upload Document')).toBeInTheDocument();
      expect(screen.getAllByTitle('Preview Document').length).toBe(4);
      expect(screen.getAllByTitle('Download File').length).toBe(4);

      // Replace & Delete must be hidden
      expect(screen.queryByTitle('Replace Document (Owner Authority)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Delete Document (Owner Authority)')).not.toBeInTheDocument();
    });

    it('grants CA read-only access with banner, NO upload, and NO Replace or Delete', async () => {
      useAuthStore.setState({
        user: { id: 'user-3', name: 'Mehta CA', email: 'ca@ssrl.com', role: 'CA' },
        token: 'fake-jwt',
      });

      renderWithProviders(<Documents />);

      await waitFor(() => {
        expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
      });

      expect(screen.getByText('CA Read-Only Document Access')).toBeInTheDocument();
      expect(screen.queryByText('Upload Document')).not.toBeInTheDocument();

      // Preview & Download must be available
      expect(screen.getAllByTitle('Preview Document').length).toBe(4);
      expect(screen.getAllByTitle('Download File').length).toBe(4);

      // Replace & Delete must be hidden
      expect(screen.queryByTitle('Replace Document (Owner Authority)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Delete Document (Owner Authority)')).not.toBeInTheDocument();

      // Fleet compliance expiry alerts must be hidden for CA
      expect(screen.queryByText('Expired Fleet Documents')).not.toBeInTheDocument();
    });
  });

  describe('Preview & Download Modal', () => {
    it('opens preview modal and fetches file blob stream', async () => {
      vi.mocked(api.previewDocumentFile).mockResolvedValue({
        blobUrl: 'blob:http://localhost/mock-blob-123',
        mimeType: 'application/pdf',
      });

      renderWithProviders(<Documents />);

      await waitFor(() => {
        expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByTitle('Preview Document');
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(api.previewDocumentFile).toHaveBeenCalledWith('doc-1');
        expect(screen.getByTitle('Preview Frame - trip_pod_signed.pdf')).toBeInTheDocument();
      });
    });

    it('gracefully handles missing storage file with user-friendly 404 alert', async () => {
      vi.mocked(api.previewDocumentFile).mockRejectedValue(new Error('Requested document file is unavailable in storage.'));

      renderWithProviders(<Documents />);

      await waitFor(() => {
        expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByTitle('Preview Document');
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Document Unavailable')).toBeInTheDocument();
        expect(
          screen.getByText(/Requested document file is unavailable in storage/)
        ).toBeInTheDocument();
      });
    });

    it('calls downloadDocumentFile on download action', async () => {
      vi.mocked(api.downloadDocumentFile).mockResolvedValue(undefined);

      renderWithProviders(<Documents />);

      await waitFor(() => {
        expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
      });

      const downloadButtons = screen.getAllByTitle('Download File');
      fireEvent.click(downloadButtons[0]);

      await waitFor(() => {
        expect(api.downloadDocumentFile).toHaveBeenCalledWith('doc-1', 'trip_pod_signed.pdf');
      });
    });
  });

  describe('Upload Modal Flow', () => {
    it('opens upload modal and submits metadata and file', async () => {
      vi.mocked(api.uploadDocument).mockResolvedValue({
        success: true,
        data: {
          id: 'doc-new',
          document_type: 'POD',
          original_name: 'test_upload.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 2048,
          uploaded_at: '2026-10-14T12:00:00Z',
          uploaded_by: 'user-2',
        },
      });

      renderWithProviders(<Documents />);

      await waitFor(() => {
        expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Upload Document'));

      expect(screen.getByRole('heading', { name: 'Upload Document' })).toBeInTheDocument();

      const entityIdInput = screen.getByPlaceholderText('e.g. 550e8400-e29b-41d4-a716-446655440000');
      fireEvent.change(entityIdInput, { target: { value: '550e8400-e29b-41d4-a716-446655440000' } });

      const file = new File(['mock content'], 'test_upload.pdf', { type: 'application/pdf' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      const submitButton = screen.getByRole('button', { name: /Upload \(1\)/ });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.uploadDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            entity_type: 'TRIP',
            entity_id: '550e8400-e29b-41d4-a716-446655440000',
            original_name: 'test_upload.pdf',
          })
        );
      });
    });
  });

  describe('Owner Replace & Delete Modals', () => {
    it('opens replace modal with mandatory reason prompt', async () => {
      vi.mocked(api.replaceDocument).mockResolvedValue({
        success: true,
        data: { ...mockDocs[0], original_name: 'replaced.pdf' },
      });

      renderWithProviders(<Documents />);

      await waitFor(() => {
        expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
      });

      const replaceButtons = screen.getAllByTitle('Replace Document (Owner Authority)');
      fireEvent.click(replaceButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Replace Document (Owner Authority)' })).toBeInTheDocument();
      });
      expect(screen.getByText(/Target Document:/)).toBeInTheDocument();

      const file = new File(['replacement content'], 'replaced.pdf', { type: 'application/pdf' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      const reasonInput = screen.getByPlaceholderText(/Renewed fitness certificate/);
      fireEvent.change(reasonInput, { target: { value: 'Updated signed POD received from client' } });

      const confirmButton = screen.getByRole('button', { name: 'Confirm Replacement' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.replaceDocument).toHaveBeenCalledWith(
          'doc-1',
          expect.objectContaining({
            original_name: 'replaced.pdf',
            reason: 'Updated signed POD received from client',
          })
        );
      });
    });

    it('opens delete modal and submits soft deletion with audit reason', async () => {
      vi.mocked(api.deleteDocument).mockResolvedValue({ success: true, message: 'Document deleted' });

      renderWithProviders(<Documents />);

      await waitFor(() => {
        expect(screen.getByText('Document Index (4)')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete Document (Owner Authority)');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Document' })).toBeInTheDocument();
      });

      const reasonInput = screen.getByPlaceholderText(/Document was uploaded in error/);
      fireEvent.change(reasonInput, { target: { value: 'Duplicate file uploaded by mistake' } });

      const confirmButton = screen.getByRole('button', { name: 'Confirm Deletion' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.deleteDocument).toHaveBeenCalledWith('doc-1', 'Duplicate file uploaded by mistake');
      });
    });
  });
});
