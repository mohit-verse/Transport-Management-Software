import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './Login';
import * as api from '../services/api';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return {
    ...actual,
    login: vi.fn(),
    getMe: vi.fn(),
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, token: null });
  });

  it('renders login form inputs and dev quick buttons in development mode', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Mobile Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Owner$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Staff$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^CA$/i })).toBeInTheDocument();
  });

  it('isolates dev quick buttons when import.meta.env.DEV is false', () => {
    const originalDev = import.meta.env.DEV;
    try {
      // Simulate production environment
      (import.meta.env as any).DEV = false;

      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      expect(screen.queryByText(/Or development quick login/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Owner$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Staff$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^CA$/i })).not.toBeInTheDocument();
      // Regular login must still be present
      expect(screen.getByLabelText(/Mobile Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
    } finally {
      (import.meta.env as any).DEV = originalDev;
    }
  });

  it('validates mobile number input before submitting', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const form = screen.getByRole('button', { name: /^Sign In$/i }).closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/Please enter a valid 10-digit mobile number/i)).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('submits credentials and sets user authentication on success', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      success: true,
      data: { token: 'real-jwt-token' },
    });

    vi.mocked(api.getMe).mockResolvedValueOnce({
      success: true,
      data: {
        user: {
          id: 'user-1',
          name: 'Owner User',
          mobile_number: '9876543210',
          role: 'OWNER',
          is_active: true,
        },
      },
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Mobile Number/i), {
      target: { value: '9876543210' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'secretpass' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({
        mobile_number: '9876543210',
        password: 'secretpass',
      });
      expect(api.getMe).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      expect(useAuthStore.getState().user?.role).toBe('OWNER');
      expect(useAuthStore.getState().token).toBe('real-jwt-token');
    });
  });

  it('supports quick login for dev testing', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /^CA$/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(useAuthStore.getState().user?.role).toBe('CA');
  });

  describe('resolveBaseUrl helper', () => {
    it('returns empty string when url is empty or root', () => {
      expect(api.resolveBaseUrl('', false)).toBe('');
      expect(api.resolveBaseUrl('  ', false)).toBe('');
      expect(api.resolveBaseUrl('/', false)).toBe('');
    });

    it('strips duplicate /api suffix', () => {
      expect(api.resolveBaseUrl('https://api.ssrl.in/api', false)).toBe('https://api.ssrl.in');
      expect(api.resolveBaseUrl('https://api.ssrl.in/api/', false)).toBe('https://api.ssrl.in');
      expect(api.resolveBaseUrl('https://api.ssrl.in', false)).toBe('https://api.ssrl.in');
    });

    it('defaults to localhost in dev and empty string in production when env is undefined', () => {
      expect(api.resolveBaseUrl(undefined, true)).toBe('http://localhost:3000');
      expect(api.resolveBaseUrl(undefined, false)).toBe('');
    });
  });
});
