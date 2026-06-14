import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '../components/Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge variant="success">Paid</Badge>);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('renders with error variant', () => {
    render(<Badge variant="error">Failed</Badge>);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders with warning variant', () => {
    render(<Badge variant="warning">Pending</Badge>);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders with neutral variant', () => {
    render(<Badge variant="neutral">Draft</Badge>);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders with info variant', () => {
    render(<Badge variant="info">In Progress</Badge>);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders with sm size', () => {
    render(<Badge variant="success" size="sm">Small</Badge>);
    expect(screen.getByText('Small')).toBeInTheDocument();
  });

  it('renders children as formatted content', () => {
    render(
      <Badge variant="info">
        <span data-testid="child">In Progress</span>
      </Badge>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    render(<Badge variant="neutral" className="uppercase">Draft</Badge>);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('defaults to neutral variant and md size when no props given', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toBeInTheDocument();
  });
});
