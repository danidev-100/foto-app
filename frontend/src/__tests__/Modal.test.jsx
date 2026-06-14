import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../components/Modal';

afterEach(() => {
  cleanup();
  // Clean up portal-rendered elements
  document.querySelectorAll('[role="dialog"]').forEach((el) => el.remove());
  document.querySelectorAll('[data-testid="modal-backdrop"]').forEach((el) => el.remove());
  // Restore body scroll
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Content</p>
      </Modal>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders content and backdrop when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal Content</p>
      </Modal>
    );
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();
  });

  it('removes content and backdrop when isOpen changes to false', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal Content</p>
      </Modal>
    );
    expect(screen.getByText('Modal Content')).toBeInTheDocument();

    rerender(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Modal Content</p>
      </Modal>
    );
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    );
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when clicking inside the modal content', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal Content</p>
      </Modal>
    );
    await user.click(screen.getByText('Modal Content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT call onClose when closeOnBackdropClick is false', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={onClose} closeOnBackdropClick={false}>
        <p>Content</p>
      </Modal>
    );
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when closeOnEscape is false', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={onClose} closeOnEscape={false}>
        <p>Content</p>
      </Modal>
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders title, children, and footer slots', () => {
    render(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Modal Title"
        footer={<button>Save</button>}
      >
        <p>Body content</p>
      </Modal>
    );
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('locks body scroll when open and restores it when closed', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Content</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Content</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('renders with size="sm" which produces a small max-width dialog', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} size="sm" title="Small">
        <p>Slim content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-sm');
  });

  it('renders with size="lg" which produces a large max-width dialog', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} size="lg" title="Large">
        <p>Wide content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-2xl');
  });

  it('renders with size="fullscreen" which fills the viewport', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} size="fullscreen" title="Full">
        <p>Full content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-[95vw]');
  });

  it('cycles focus on Tab and Shift+Tab within the modal', async () => {
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={() => {}} title="Form">
        <input data-testid="input-1" type="text" />
        <input data-testid="input-2" type="text" />
        <button data-testid="btn-submit">Submit</button>
      </Modal>
    );

    // Wait for initial focus
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('input-1'));
    });

    // Tab to input-2
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('input-2'));

    // Tab to submit button
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('btn-submit'));

    // Tab wraps back to input-1
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('input-1'));

    // Shift+Tab wraps to btn-submit
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByTestId('btn-submit'));
  });
});
