/**
 * Login page frontend tests.
 *
 * Covers:
 *  - Render login form
 *  - Form fields exist
 *  - Link to register page
 *  - Submit calls login API
 *  - Shows error on failure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import Login from '../pages/Login';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock auth API
vi.mock('../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

import { login as loginApi } from '../api/auth';

function renderLogin() {
  return render(
    <AuthProvider>
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    </AuthProvider>
  );
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the login form', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('has a link to register page', () => {
    renderLogin();
    const link = screen.getByText(/creá una gratis/i);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/register');
  });

  it('shows error on failed login', async () => {
    loginApi.mockRejectedValueOnce({
      response: { data: { error: { message: 'Credenciales inválidas' } } },
    });

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'test@test.com');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument();
    });
  });

  it('calls login API on submit', async () => {
    loginApi.mockResolvedValueOnce({
      data: { data: { token: 'xxx', student: { id: '1', name: 'Test', email: 'test@test.com' } } },
    });

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'test@test.com');
    await user.type(screen.getByLabelText('Contraseña'), 'correct');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(loginApi).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'correct',
      });
    });
  });
});
