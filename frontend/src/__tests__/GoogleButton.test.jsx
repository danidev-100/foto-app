/**
 * GoogleButton component tests.
 *
 * Covers:
 *  - Renders nothing when Google login is not configured
 *  - Loads GIS and renders the Google button when configured
 *  - Calls onSuccess with the credential (ID token) from the GIS callback
 *  - Shows an error when the login call fails
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoogleButton from '../components/GoogleButton';

// Mock the api client (config fetch + nothing else)
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '../api/client';

// Fake GIS global
const renderButtonMock = vi.fn();
const initializeMock = vi.fn();
let gsiCallback = null;

function setupGsiGlobal() {
  window.google = {
    accounts: {
      id: {
        initialize: initializeMock,
        renderButton: renderButtonMock,
      },
    },
  };
}

function renderGoogleButton(overrides = {}) {
  const props = { onSuccess: vi.fn().mockResolvedValue(undefined), ...overrides };
  render(<GoogleButton {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete window.google;
  gsiCallback = null;
  document.head.innerHTML = '';
  initializeMock.mockImplementation((opts) => {
    gsiCallback = opts.callback;
  });
});

describe('GoogleButton', () => {
  it('renders nothing when Google login is not configured', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { clientId: '' } } });

    const { container } = render(<GoogleButton onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/config/google-login');
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the config request fails', async () => {
    api.get.mockRejectedValueOnce(new Error('network'));

    const { container } = render(<GoogleButton onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders the Google button when configured', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { clientId: 'test-client-id' } } });
    setupGsiGlobal();

    renderGoogleButton();

    await waitFor(() => {
      expect(initializeMock).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 'test-client-id' }),
      );
      expect(renderButtonMock).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ theme: 'outline' }),
      );
    });
  });

  it('calls onSuccess with the credential from the GIS callback', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { clientId: 'test-client-id' } } });
    setupGsiGlobal();

    const props = renderGoogleButton();

    await waitFor(() => {
      expect(gsiCallback).toEqual(expect.any(Function));
    });

    await gsiCallback({ credential: 'fake-google-id-token' });

    expect(props.onSuccess).toHaveBeenCalledWith('fake-google-id-token');
  });

  it('shows an error message when the login call fails', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { clientId: 'test-client-id' } } });
    setupGsiGlobal();

    renderGoogleButton({ onSuccess: vi.fn().mockRejectedValueOnce(new Error('boom')) });

    await waitFor(() => {
      expect(gsiCallback).toEqual(expect.any(Function));
    });

    await gsiCallback({ credential: 'bad-token' });

    expect(await screen.findByText(/no se pudo iniciar sesión/i)).toBeInTheDocument();
  });
});