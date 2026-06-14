import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '../components/Pagination';

describe('Pagination — boundary disable', () => {
  it('disables Previous on first page, enables Next, shows page info', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={vi.fn()} />);
    const prev = screen.getByRole('button', { name: /previous/i });
    const next = screen.getByRole('button', { name: /next/i });
    expect(prev).toBeDisabled();
    expect(next).not.toBeDisabled();
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
  });

  it('disables Next on last page, enables Previous', () => {
    render(<Pagination page={5} totalPages={5} onPageChange={vi.fn()} />);
    const prev = screen.getByRole('button', { name: /previous/i });
    const next = screen.getByRole('button', { name: /next/i });
    expect(prev).not.toBeDisabled();
    expect(next).toBeDisabled();
    expect(screen.getByText('Page 5 of 5')).toBeInTheDocument();
  });
});

describe('Pagination — page change callback', () => {
  it('calls onPageChange with next page when Next is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange with previous page when Previous is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe('Pagination — hide on single page', () => {
  it('returns null when totalPages is 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when totalPages is 0', () => {
    const { container } = render(
      <Pagination page={1} totalPages={0} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('Pagination — page info toggle', () => {
  it('hides page info when showPageInfo is false', () => {
    render(
      <Pagination
        page={2}
        totalPages={5}
        onPageChange={vi.fn()}
        showPageInfo={false}
      />
    );
    expect(screen.queryByText(/page/i)).toBeNull();
    expect(
      screen.getByRole('button', { name: /previous/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /next/i })
    ).toBeInTheDocument();
  });
});
