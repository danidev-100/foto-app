import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToastProvider, { useToast } from '../components/ToastProvider';

// Helper: component that triggers toasts using the hook
function ToastTrigger({ message, type = 'success', options }) {
  const toast = useToast();
  return <button onClick={() => toast[type](message, options)}>Show Toast</button>;
}

// Helper: component that fires multiple toasts at once
function MultiToast() {
  const toast = useToast();
  return (
    <button
      onClick={() => {
        toast.success('First');
        toast.error('Second');
        toast.info('Third');
      }}
    >
      Show All
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('ToastProvider', () => {
  it('provides toast.success, toast.error, toast.info via useToast', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Hello" type="success" />
      </ToastProvider>
    );
    expect(screen.getByText('Show Toast')).toBeInTheDocument();
  });

  it('renders a success toast with the message when toast.success is called', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Booklet created" type="success" />
      </ToastProvider>
    );
    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Booklet created')).toBeInTheDocument();
  });

  it('renders an error toast with the message when toast.error is called', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Network error" type="error" />
      </ToastProvider>
    );
    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders an info toast with the message when toast.info is called', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Update available" type="info" />
      </ToastProvider>
    );
    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Update available')).toBeInTheDocument();
  });

  it('manually dismisses a toast when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Dismiss me" type="info" />
      </ToastProvider>
    );
    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Dismiss me')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('auto-dismisses a toast after a custom short duration', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider duration={50}>
        <ToastTrigger message="Auto bye" type="success" options={{ duration: 50 }} />
      </ToastProvider>
    );
    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Auto bye')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByText('Auto bye')).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('stacks multiple toasts when called rapidly', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <MultiToast />
      </ToastProvider>
    );
    await user.click(screen.getByText('Show All'));

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('caps visible toasts at 5 and removes oldest first on overflow', async () => {
    const user = userEvent.setup();

    function OverflowTrigger() {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            toast.success('Toast 1');
            toast.success('Toast 2');
            toast.success('Toast 3');
            toast.success('Toast 4');
            toast.success('Toast 5');
            toast.success('Toast 6');
            toast.success('Toast 7');
          }}
        >
          Overflow
        </button>
      );
    }

    render(
      <ToastProvider>
        <OverflowTrigger />
      </ToastProvider>
    );
    await user.click(screen.getByText('Overflow'));

    // Oldest 2 should be removed (newest 5 remain)
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Toast 2')).not.toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
    expect(screen.getByText('Toast 4')).toBeInTheDocument();
    expect(screen.getByText('Toast 5')).toBeInTheDocument();
    expect(screen.getByText('Toast 6')).toBeInTheDocument();
    expect(screen.getByText('Toast 7')).toBeInTheDocument();
  });

  it('throws an error if useToast is used outside ToastProvider', () => {
    function BadComponent() {
      useToast();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useToast must be used within ToastProvider'
    );
  });
});
