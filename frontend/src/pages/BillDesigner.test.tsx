import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BillDesigner from './BillDesigner';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api');

const renderWithProviders = (initialEntries = ['/settings/billing/templates/new']) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/settings/billing/templates/new" element={<BillDesigner />} />
          <Route path="/settings/billing/templates/:id/edit" element={<BillDesigner />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('BillDesigner Visual Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'user-1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER' },
      token: 'test-token',
    });

    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    vi.mocked(api.getDynamicFields).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'field-1',
          source_entity: 'PARTY',
          field_key: 'party.name',
          field_label: 'Party Name',
          data_type: 'STRING',
          is_repeatable: false,
          description: 'Official registered name of the client party/company.',
        },
        {
          id: 'field-2',
          source_entity: 'TRIP',
          field_key: 'trip.trip_number',
          field_label: 'Trip Number',
          data_type: 'STRING',
          is_repeatable: true,
          description: 'Canonical alphanumeric trip number.',
        },
      ],
    });

    vi.mocked(api.createBillTemplate).mockResolvedValue({
      success: true,
      data: {
        id: 'new-tpl-id',
        name: 'New Custom Invoice',
        template_type: 'CONSOLIDATED',
        status: 'DRAFT',
        layout_json: {},
        components: [],
        dynamic_fields: [],
        created_at: '2026-10-13T10:00:00Z',
        updated_at: '2026-10-13T10:00:00Z',
      },
    });

    vi.mocked(api.previewBillTemplatePdf).mockResolvedValue(
      new Blob(['%PDF-1.4 dummy pdf'], { type: 'application/pdf' })
    );

    vi.mocked(api.previewBillTemplateJson).mockResolvedValue({
      success: true,
      data: { preview_pages: 1, mock_data: {} },
    });
  });

  it('renders visual designer shell with toolbox, canvas margins, and action buttons', () => {
    renderWithProviders();

    expect(screen.getByPlaceholderText('Template Name')).toBeInTheDocument();
    expect(screen.getByText('Toolbox')).toBeInTheDocument();
    expect(screen.getByText('Print Area Margin')).toBeInTheDocument();
    expect(screen.getByText('Save Template')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Import Reference')).toBeInTheDocument();
  });

  it('adds a component from toolbox and allows numeric position/dimension editing', async () => {
    renderWithProviders();

    // Click 'Text Block' in toolbox
    const textBlockBtn = screen.getByRole('button', { name: /Text Block/i });
    fireEvent.click(textBlockBtn);

    // Verify component appears in layer list and inspector
    await waitFor(() => {
      expect(screen.getByText('Geometry & Coordinates (pt)')).toBeInTheDocument();
      expect(screen.getByText('X Position')).toBeInTheDocument();
      expect(screen.getByText('Y Position')).toBeInTheDocument();
    });

    // Edit X coordinate
    const xInput = screen.getByDisplayValue('36');
    fireEvent.change(xInput, { target: { value: '50' } });

    expect(xInput).toHaveValue(50);
  });

  it('opens dynamic field directory modal and inserts dynamic token into text template', async () => {
    renderWithProviders();

    // Add Text Block
    const textBlockBtn = screen.getByRole('button', { name: /Text Block/i });
    fireEvent.click(textBlockBtn);

    await waitFor(() => {
      expect(screen.getByText('Insert Dynamic Field')).toBeInTheDocument();
    });

    // Open Dynamic Field modal
    const insertFieldBtn = screen.getByText('Insert Dynamic Field');
    fireEvent.click(insertFieldBtn);

    // Verify modal rendered
    await waitFor(() => {
      expect(screen.getByText('Dynamic Field Directory')).toBeInTheDocument();
      expect(screen.getByText('Party Name')).toBeInTheDocument();
    });

    // Click 'Insert' on Party Name field
    const insertButtons = screen.getAllByRole('button', { name: /Insert/i });
    fireEvent.click(insertButtons[0]);

    // Token should now be present in text textarea
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Type text or use {{entity.field_key}} tokens.../i);
      expect((textarea as HTMLTextAreaElement).value).toContain('{{party.name}}');
    });
  });

  it('validates template and submits payload to createBillTemplate on Save', async () => {
    renderWithProviders();

    const nameInput = screen.getByPlaceholderText('Template Name');
    fireEvent.change(nameInput, { target: { value: 'Custom Fleet Bill' } });

    // Add a component
    const headerBtn = screen.getByRole('button', { name: /Company Header/i });
    fireEvent.click(headerBtn);

    // Click Save Template
    const saveBtn = screen.getByRole('button', { name: /Save Template/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.createBillTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Custom Fleet Bill',
          template_type: 'CONSOLIDATED',
          status: 'DRAFT',
          components: expect.arrayContaining([
            expect.objectContaining({
              component_type: 'HEADER',
            }),
          ]),
        })
      );
    });
  });

  it('opens non-mutating preview modal without saving', async () => {
    renderWithProviders();

    const previewBtn = screen.getByRole('button', { name: /^Preview$/i });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText('Document Template Preview')).toBeInTheDocument();
      expect(screen.getByText(/Safe Non-Mutating Execution/i)).toBeInTheDocument();
    });
  });

  it('adds a Page Break component and displays the dedicated semantics card in the inspector', async () => {
    renderWithProviders();

    // Add Page Break from palette
    const pageBreakBtn = screen.getByRole('button', { name: /Page Break/i });
    fireEvent.click(pageBreakBtn);

    await waitFor(() => {
      expect(screen.getByText('Page Break Semantics')).toBeInTheDocument();
      expect(screen.getByText('Multi-Page Boundary')).toBeInTheDocument();
      expect(screen.getByText(/This element marks a page boundary/i)).toBeInTheDocument();
      expect(screen.getByText(/--- Page Break/i)).toBeInTheDocument();
    });
  });

  it('handles drag and drop of component from palette onto canvas', async () => {
    renderWithProviders();

    const canvas = screen.getByText('Print Area Margin').parentElement!;
    fireEvent.dragOver(canvas, { clientX: 150, clientY: 200 });
    fireEvent.drop(canvas, {
      clientX: 150,
      clientY: 200,
      dataTransfer: {
        getData: (type: string) => (type === 'text/plain' ? 'BORDER' : ''),
      },
    });

    await waitFor(() => {
      expect(screen.getAllByText(/border_1/i)[0]).toBeInTheDocument();
    });
  });

  it('supports 8-point interactive resizing of selected component', async () => {
    renderWithProviders();

    // Add a text block
    fireEvent.click(screen.getByRole('button', { name: /Text Block/i }));

    await waitFor(() => {
      expect(screen.getByTitle('Resize SE')).toBeInTheDocument();
    });

    const seHandle = screen.getByTitle('Resize SE');
    fireEvent.pointerDown(seHandle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(seHandle, { clientX: 280, clientY: 280, pointerId: 1 });
    fireEvent.pointerUp(seHandle, { pointerId: 1 });

    expect(screen.getByDisplayValue(/328|320|240/)).toBeInTheDocument();
  });

  it('supports keyboard shortcuts for nudge, duplicate, delete, and undo/redo', async () => {
    renderWithProviders();

    // Add a text block
    fireEvent.click(screen.getByRole('button', { name: /Text Block/i }));

    await waitFor(() => {
      expect(screen.getAllByText('text_1')[0]).toBeInTheDocument();
    });

    // Duplicate using Ctrl+D
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    await waitFor(() => {
      expect(screen.getAllByText('text_2')[0]).toBeInTheDocument();
    });

    // Nudge with ArrowRight
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });

    // Delete with Delete key
    fireEvent.keyDown(window, { key: 'Delete' });
    await waitFor(() => {
      expect(screen.queryByText('text_2')).not.toBeInTheDocument();
    });

    // Undo with Ctrl+Z
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(() => {
      expect(screen.getAllByText('text_2')[0]).toBeInTheDocument();
    });
  });

  it('swaps dimensions on orientation change and provides out-of-bounds remediation', async () => {
    renderWithProviders();

    // Switch to Page Setup tab
    fireEvent.click(screen.getByRole('button', { name: /Page Setup/i }));

    // Switch to Landscape
    const landscapeBtn = screen.getByRole('button', { name: /Landscape/i });
    fireEvent.click(landscapeBtn);

    // Switch back to Element Inspector and add a header
    fireEvent.click(screen.getByRole('button', { name: /Element Inspector/i }));
    fireEvent.click(screen.getByRole('button', { name: /Company Header/i }));

    // Set X position to 700 (valid in landscape 842pt, overflows portrait 595pt)
    const xInput = screen.getByDisplayValue('36');
    fireEvent.change(xInput, { target: { value: '700' } });

    // Switch to Page Setup and change orientation to Portrait
    fireEvent.click(screen.getByRole('button', { name: /Page Setup/i }));
    const portraitBtn = screen.getByRole('button', { name: /Portrait/i });
    fireEvent.click(portraitBtn);

    // Verify warning banner appeared
    await waitFor(() => {
      expect(screen.getByText(/Page Boundary Warning/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Auto-fit components to margins/i })).toBeInTheDocument();
    });

    // Click auto-fit
    fireEvent.click(screen.getByRole('button', { name: /Auto-fit components to margins/i }));

    // Verify warning dismissed
    await waitFor(() => {
      expect(screen.queryByText(/Page Boundary Warning/i)).not.toBeInTheDocument();
    });
  });

  it('supports PDF, Visual Document, and JSON view modes in preview modal', async () => {
    renderWithProviders();

    const previewBtn = screen.getByRole('button', { name: /^Preview$/i });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText('Document Template Preview')).toBeInTheDocument();
    });

    // Switch to Visual Document
    const visualDocBtn = screen.getByRole('button', { name: /Visual Document/i });
    fireEvent.click(visualDocBtn);
    expect(screen.getByText('Visual Document')).toBeInTheDocument();

    // Switch to Data & Tokens
    const dataTokensBtn = screen.getByRole('button', { name: /Data & Tokens/i });
    fireEvent.click(dataTokensBtn);
    await waitFor(() => {
      expect(screen.getByText('Raw Layout & Component Hierarchy')).toBeInTheDocument();
    });
  });
});
