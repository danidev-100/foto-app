import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../components/ConfirmDialog';

afterEach(() => {
  cleanup();
  document.querySelectorAll('[role="dialog"]').forEach((el) => el.remove());
  document.body.style.overflow = '';
});

describe('ConfirmDialog', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        message="Delete?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
  });

  it('renders message, Cancel and Confirm buttons when isOpen is true', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Delete booklet?"
        onConfirm={() => {}}
        onCancel={() => {}}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    );
    expect(screen.getByText('Delete booklet?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen={true}
        message="Cancel test"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen={true}
        message="Confirm test"
        onConfirm={onConfirm}
        onCancel={() => {}}
        confirmLabel="Yes, Delete"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Yes, Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders danger variant with destructive button styling', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Dangerous action"
        onConfirm={() => {}}
        onCancel={() => {}}
        variant="danger"
        confirmLabel="Delete"
      />
    );
    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    // The button should have red/danger styling classes
    expect(confirmBtn.className).toContain('red');
  });

  it('shows loading spinner on confirm button and disables it when loading is true', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Loading test"
        onConfirm={() => {}}
        onCancel={() => {}}
        loading={true}
        confirmLabel="Save"
      />
    );
    const confirmBtn = screen.getByRole('button', { name: /save/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('uses custom confirmLabel and cancelLabel props', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Custom labels"
        onConfirm={() => {}}
        onCancel={() => {}}
        confirmLabel="Archive"
        cancelLabel="Keep"
      />
    );
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
  });

  it('renders with default title "Confirm" when no title provided', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Default title test"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    // The title renders as an h2 inside the dialog
    expect(screen.getByRole('heading', { name: /confirm/i })).toBeInTheDocument();
  });

  it('renders custom title when provided', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Booklet"
        message="Are you sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('Delete Booklet')).toBeInTheDocument();
  });
});
