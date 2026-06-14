/**
 * Register page frontend tests.
 *
 * Covers:
 *  - Shows form fields
 *  - Required fields marked
 *  - Calls register API on submit
 *  - Shows error on failure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import Register from '../pages/Register';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock auth API (used by AuthContext)
vi.mock('../api/auth', () => ({
  register: vi.fn(),
  login: vi.fn(),
}));

import { register as registerApi } from '../api/auth';

function renderRegister() {
  return render(
    <AuthProvider>
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    </AuthProvider>
  );
}

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows form fields', () => {
    renderRegister();

    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument();
  });

  it('required fields have required attribute', () => {
    renderRegister();

    const nameInput = screen.getByLabelText('Nombre completo');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Contraseña');

    expect(nameInput).toHaveAttribute('required');
    expect(emailInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('minLength', '6');
  });

  it('has a link to login page', () => {
    renderRegister();

    const link = screen.getByText(/iniciar sesión/i);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/login');
  });

  it('calls register API and navigates on success', async () => {
    registerApi.mockResolvedValueOnce({
      data: {
        data: {
          token: 'mock-token',
          refreshToken: 'mock-refresh',
          student: { id: 's1', name: 'New User', email: 'new@test.com', isAdmin: false },
        },
      },
    });

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nombre completo'), 'New User');
    await user.type(screen.getByLabelText('Email'), 'new@test.com');
    await user.type(screen.getByLabelText('Contraseña'), 'SecurePass123');

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(registerApi).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@test.com',
        password: 'SecurePass123',
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message on API failure', async () => {
    registerApi.mockRejectedValueOnce({
      response: { data: { error: { message: 'El email ya está registrado' } } },
    });

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nombre completo'), 'New User');
    await user.type(screen.getByLabelText('Email'), 'existing@test.com');
    await user.type(screen.getByLabelText('Contraseña'), 'SecurePass123');

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText('El email ya está registrado')).toBeInTheDocument();
    });

    // Should NOT navigate on error
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
