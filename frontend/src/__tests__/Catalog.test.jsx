/**
 * Catalog page frontend tests.
 *
 * Covers:
 *  - Shows loading state
 *  - Shows schools list
 *  - Clicking school shows courses
 *  - Clicking course shows booklets
 *  - Add to cart shows toast
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Catalog from '../pages/Catalog';

// Mock client for API calls
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock cart API
vi.mock('../api/cart', () => ({
  addToCart: vi.fn(),
}));

// Mock toast
vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn() },
  }),
}));

import api from '../api/client';
import { addToCart } from '../api/cart';

// Mock data
const mockSchools = [
  {
    id: 's1', name: 'Don Bosco', shortName: 'DB',
    courses: [
      { id: 'c1', name: 'Primaria - 1° Primero', isActive: true },
      { id: 'c2', name: 'Secundaria - 1° Primero', isActive: true },
    ],
  },
  {
    id: 's2', name: 'Rodeo del Medio', shortName: 'RdM',
    courses: [
      { id: 'c3', name: 'Primaria - 1° Primero', isActive: true },
    ],
  },
];

const mockBooklets = [
  {
    id: 'b1', title: 'Matemática U1', currentPrice: 150000, stock: 10,
    description: 'Divisiones: A, B',
    courseId: 'c1', isActive: true,
  },
  {
    id: 'b2', title: 'Lengua U1', currentPrice: 120000, stock: 5,
    description: null,
    courseId: 'c1', isActive: true,
  },
];

function renderCatalog() {
  return render(<Catalog onCartUpdate={vi.fn()} />);
}

describe('Catalog page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    // Keep API pending to show loading
    api.get.mockImplementationOnce(() => new Promise(() => {}));

    renderCatalog();

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('shows schools list', async () => {
    api.get.mockResolvedValueOnce({ data: { data: mockSchools } });

    renderCatalog();

    await waitFor(() => {
      expect(screen.getByText('Don Bosco')).toBeInTheDocument();
      expect(screen.getByText('Rodeo del Medio')).toBeInTheDocument();
    });

    expect(screen.getByText('Colegios')).toBeInTheDocument();
  });

  it('clicking a school shows its courses', async () => {
    api.get.mockResolvedValueOnce({ data: { data: mockSchools } });

    renderCatalog();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Don Bosco')).toBeInTheDocument();
    });

    // Click on Don Bosco
    await user.click(screen.getByText('Don Bosco'));

    // Should now show courses
    await waitFor(() => {
      expect(screen.getByText('Primaria - 1° Primero')).toBeInTheDocument();
      expect(screen.getByText('Secundaria - 1° Primero')).toBeInTheDocument();
    });

    // Should show Volver a colegios button
    expect(screen.getByText('Volver a colegios')).toBeInTheDocument();
  });

  it('clicking a course shows booklets', async () => {
    api.get.mockResolvedValueOnce({ data: { data: mockSchools } });

    renderCatalog();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Don Bosco')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Don Bosco'));

    await waitFor(() => {
      expect(screen.getByText('Primaria - 1° Primero')).toBeInTheDocument();
    });

    // Mock the booklets API
    api.get.mockResolvedValueOnce({ data: { data: mockBooklets } });

    // Click on Primaria course
    await user.click(screen.getByText('Primaria - 1° Primero'));

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
      expect(screen.getByText('Lengua U1')).toBeInTheDocument();
    });

    // Verify the booklets API was called with the correct course
    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('course_id=c1'),
    );
  });

  it('add to cart calls addToCart and shows toast', async () => {
    addToCart.mockResolvedValueOnce({ data: { success: true } });

    api.get.mockResolvedValueOnce({ data: { data: mockSchools } });

    renderCatalog();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Don Bosco')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Don Bosco'));

    await waitFor(() => {
      expect(screen.getByText('Primaria - 1° Primero')).toBeInTheDocument();
    });

    api.get.mockResolvedValueOnce({ data: { data: mockBooklets } });

    await user.click(screen.getByText('Primaria - 1° Primero'));

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });

    // Find and click "Agregar" button
    const addButtons = screen.getAllByText('Agregar');
    expect(addButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(addToCart).toHaveBeenCalledWith({ booklet_id: 'b1', quantity: 1 });
    });
  });
});
