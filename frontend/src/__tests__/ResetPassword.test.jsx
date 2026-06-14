/**
 * ResetPassword page tests.
 *
 * Covers:
 *  - Render password inputs with token from URL
 *  - Shows validation error when passwords don't match
 *  - Submits and shows success toast + redirects to login
 *  - Shows error on API failure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, useNavigate } from 'react-router-dom';
import ResetPassword from '../pages/ResetPassword';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ token: 'test-reset-token-123' }) };
});

// Mock the auth API
vi.mock('../api/auth', () => ({
  resetPassword: vi.fn(),
}));

// Mock useToast
const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock('../components/ToastProvider', () => ({
  useToast: () => mockToast,
}));

import { resetPassword } from '../api/auth';

function renderResetPassword() {
  return render(
    <BrowserRouter>
      <ResetPassword />
    </BrowserRouter>
  );
}

describe('ResetPassword page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders password inputs and submit button', () => {
    renderResetPassword();
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar contraseña/i })).toBeInTheDocument();
  });

  it('shows validation error when passwords do not match', async () => {
    renderResetPassword();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nueva contraseña'), 'Password123!');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'DifferentPass456!');
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText(/contraseñas no coinciden/i)).toBeInTheDocument();
    });

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('calls resetPassword API and shows success toast then redirects', async () => {
    resetPassword.mockResolvedValueOnce({
      data: { data: { message: 'Contraseña actualizada exitosamente' } },
    });

    renderResetPassword();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nueva contraseña'), 'NewPass123!');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        token: 'test-reset-token-123',
        newPassword: 'NewPass123!',
      });
    });

    expect(mockToast.success).toHaveBeenCalledWith(
      expect.stringContaining('actualizada')
    );

    // navigate is called inside setTimeout(..., 2000)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    }, { timeout: 3000 });
  });

  it('shows error on API failure', async () => {
    resetPassword.mockRejectedValueOnce({
      response: { data: { error: { message: 'Token inválido o expirado' } } },
    });

    renderResetPassword();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nueva contraseña'), 'NewPass123!');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText('Token inválido o expirado')).toBeInTheDocument();
    });
  });
});
