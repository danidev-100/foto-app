import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Loading from '../components/Loading';

describe('Loading — spinner variant', () => {
  it('renders a spinner element', () => {
    const { container } = render(<Loading variant="spinner" />);
    const spinner = container.querySelector('[data-testid="loading-spinner"]');
    expect(spinner).toBeInTheDocument();
  });
});

describe('Loading — skeleton variant', () => {
  it('renders 3 skeleton lines by default', () => {
    const { container } = render(<Loading variant="skeleton" />);
    const lines = container.querySelectorAll('[data-testid="skeleton-line"]');
    expect(lines).toHaveLength(3);
  });

  it('renders a single skeleton line with count=1', () => {
    const { container } = render(<Loading variant="skeleton" count={1} />);
    const lines = container.querySelectorAll('[data-testid="skeleton-line"]');
    expect(lines).toHaveLength(1);
  });

  it('renders specified count of skeleton lines', () => {
    const { container } = render(<Loading variant="skeleton" count={5} />);
    const lines = container.querySelectorAll('[data-testid="skeleton-line"]');
    expect(lines).toHaveLength(5);
  });
});

describe('Loading — card variant', () => {
  it('renders a card skeleton with image block and 2 lines', () => {
    const { container } = render(<Loading variant="card" count={1} />);
    const cards = container.querySelectorAll('[data-testid="skeleton-card"]');
    expect(cards).toHaveLength(1);
    const imageBlock = cards[0].querySelector(
      '[data-testid="skeleton-card-image"]'
    );
    expect(imageBlock).toBeInTheDocument();
    const lines = cards[0].querySelectorAll('[data-testid="skeleton-line"]');
    expect(lines).toHaveLength(2);
  });

  it('renders multiple card skeletons with count prop', () => {
    const { container } = render(<Loading variant="card" count={2} />);
    const cards = container.querySelectorAll('[data-testid="skeleton-card"]');
    expect(cards).toHaveLength(2);
  });
});

describe('Loading — custom className', () => {
  it('renders with custom className without crashing', () => {
    const { container } = render(
      <Loading variant="spinner" className="h-64" />
    );
    const spinner = container.querySelector('[data-testid="loading-spinner"]');
    expect(spinner).toBeInTheDocument();
  });
});
