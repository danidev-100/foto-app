/**
 * ForgotPassword page tests.
 *
 * Covers:
 *  - Render email input and submit button
 *  - Shows success message on submit
 *  - Shows error on API failure
 *  - Link back to login
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ForgotPassword from '../pages/ForgotPassword';

// Mock the auth API
vi.mock('../api/auth', () => ({
  forgotPassword: vi.fn(),
}));

import { forgotPassword } from '../api/auth';

function renderForgotPassword() {
  return render(
    <BrowserRouter>
      <ForgotPassword />
    </BrowserRouter>
  );
}

describe('ForgotPassword page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input and submit button', () => {
    renderForgotPassword();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('shows success message on successful submission', async () => {
    forgotPassword.mockResolvedValueOnce({
      data: { data: { message: 'Si el email existe, recibirás un enlace de recuperación' } },
    });

    renderForgotPassword();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => {
      expect(screen.getByText(/recibirás un enlace/i)).toBeInTheDocument();
    });

    expect(forgotPassword).toHaveBeenCalledWith('student@example.com');
  });

  it('shows error message on API failure', async () => {
    forgotPassword.mockRejectedValueOnce({
      response: { data: { error: { message: 'Error al procesar la solicitud' } } },
    });

    renderForgotPassword();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => {
      expect(screen.getByText('Error al procesar la solicitud')).toBeInTheDocument();
    });
  });

  it('has a link back to login', () => {
    renderForgotPassword();
    const link = screen.getByText(/volver al inicio/i);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/login');
  });

  it('shows success view after submit and hides the form', async () => {
    forgotPassword.mockResolvedValueOnce({
      data: { data: { message: 'Si el email existe, recibirás un enlace de recuperación' } },
    });

    renderForgotPassword();
    const user = userEvent.setup();

    // Initially form is visible
    expect(screen.getByLabelText('Email')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'test@test.com');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => {
      // Form should be replaced by success message
      expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
      expect(screen.getByText(/recibirás un enlace/i)).toBeInTheDocument();
    });
  });
});
