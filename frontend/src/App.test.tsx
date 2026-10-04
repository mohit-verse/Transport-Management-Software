/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Layout', () => {
  it('renders login page by default for unauthenticated users', () => {
    render(<App />);
    expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
  });
});
