import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from '../components/EmptyState';

function InboxIcon() {
  return <svg data-testid="inbox-icon" />;
}

function SearchIcon() {
  return <svg data-testid="search-icon" />;
}

describe('EmptyState', () => {
  it('renders message text', () => {
    render(<EmptyState message="No orders yet" />);
    expect(screen.getByText('No orders yet')).toBeInTheDocument();
  });

  it('renders icon above the message', () => {
    render(<EmptyState icon={InboxIcon} message="No orders yet" />);
    expect(screen.getByTestId('inbox-icon')).toBeInTheDocument();
  });

  it('renders action button and calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        message="Cart is empty"
        action={{ label: 'Browse Catalog', onClick }}
      />
    );
    const button = screen.getByRole('button', { name: 'Browse Catalog' });
    expect(button).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders description below the message', () => {
    render(
      <EmptyState
        message="No students"
        description="Students will appear once they register"
      />
    );
    expect(screen.getByText('No students')).toBeInTheDocument();
    expect(
      screen.getByText('Students will appear once they register')
    ).toBeInTheDocument();
  });

  it('renders without icon when none provided', () => {
    const { container } = render(<EmptyState message="Just text" />);
    expect(screen.getByText('Just text')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders custom icon component', () => {
    render(<EmptyState icon={SearchIcon} message="No results" />);
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('wraps long message text', () => {
    const longMsg =
      'No booklets match your filters. Try adjusting your search criteria.';
    render(<EmptyState message={longMsg} />);
    expect(screen.getByText(longMsg)).toBeInTheDocument();
  });
});
