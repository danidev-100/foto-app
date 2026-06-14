/**
 * Cart page frontend tests.
 *
 * Covers:
 *  - Shows empty state when no items
 *  - Shows cart items
 *  - Can update quantity
 *  - Can remove item
 *  - Shows checkout buttons
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ToastProvider from '../components/ToastProvider';
import Cart from '../pages/Cart';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock cart API
vi.mock('../api/cart', () => ({
  getCart: vi.fn(),
  updateCartItem: vi.fn(),
  removeFromCart: vi.fn(),
  clearCart: vi.fn(),
}));

// Mock orders API
vi.mock('../api/orders', () => ({
  placeOrder: vi.fn(),
  initMPCheckout: vi.fn(),
}));

// Mock ToastProvider (useToast hook)
vi.mock('../components/ToastProvider', async () => {
  const actual = await vi.importActual('../components/ToastProvider');
  return {
    ...actual,
    useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }),
  };
});

import { getCart, updateCartItem, removeFromCart, clearCart } from '../api/cart';
import { placeOrder, initMPCheckout } from '../api/orders';

// Mock data
const mockCartItems = {
  id: 'cart-1',
  studentId: 'student-1',
  items: [
    {
      id: 'item-1', cartId: 'cart-1', bookletId: 'b1', title: 'Matemática U1',
      quantity: 2, unitPrice: 1500, subtotal: 3000,
    },
    {
      id: 'item-2', cartId: 'cart-1', bookletId: 'b2', title: 'Lengua U1',
      quantity: 1, unitPrice: 2000, subtotal: 2000,
    },
  ],
  total: 5000,
};

function renderCart() {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <Cart />
      </ToastProvider>
    </BrowserRouter>
  );
}

describe('Cart page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getCart.mockImplementationOnce(() => new Promise(() => {}));

    renderCart();

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('shows empty state when no items', async () => {
    getCart.mockResolvedValueOnce({ data: { data: { id: 'cart-1', items: [], total: 0 } } });

    renderCart();

    await waitFor(() => {
      expect(screen.getByText('Tu carrito está vacío')).toBeInTheDocument();
    });

    // Should show a link to browse booklets
    expect(screen.getByText('Ver cuadernillos')).toBeInTheDocument();
  });

  it('shows cart items', async () => {
    getCart.mockResolvedValueOnce({ data: { data: mockCartItems } });

    renderCart();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
      expect(screen.getByText('Lengua U1')).toBeInTheDocument();
    });

    // Shows item count
    expect(screen.getByText(/2 items/i)).toBeInTheDocument();
    // Shows total
    expect(screen.getByText('Mi Carrito')).toBeInTheDocument();
  });

  it('can update item quantity', async () => {
    getCart
      .mockResolvedValueOnce({ data: { data: mockCartItems } }) // initial load
      .mockResolvedValueOnce({ data: { data: mockCartItems } }); // after update reload

    updateCartItem.mockResolvedValueOnce({ data: { success: true } });

    renderCart();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });

    // Find "+" button for Matemática U1 (first item)
    const plusButtons = screen.getAllByText('+');
    expect(plusButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(plusButtons[0]);

    await waitFor(() => {
      expect(updateCartItem).toHaveBeenCalled();
    });
  });

  it('can remove item', async () => {
    getCart
      .mockResolvedValueOnce({ data: { data: mockCartItems } })
      .mockResolvedValueOnce({ data: { data: { ...mockCartItems, items: [mockCartItems.items[1]] } } });

    removeFromCart.mockResolvedValueOnce({ data: { success: true } });

    renderCart();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });

    // Find delete buttons and click the first one
    const deleteButtons = document.querySelectorAll('button');
    // The delete button has an SVG with the X icon — let's look for the parent button
    const removeButton = screen.getAllByRole('button').find(
      (btn) => btn.querySelector('svg path')?.getAttribute('d')?.includes('M6 18L18 6')
    );
    if (removeButton) {
      await user.click(removeButton);
    }

    await waitFor(() => {
      expect(removeFromCart).toHaveBeenCalled();
    });
  });

  it('shows checkout buttons (Mercado Pago, Efectivo, Transferencia)', async () => {
    getCart.mockResolvedValueOnce({ data: { data: mockCartItems } });

    renderCart();

    await waitFor(() => {
      expect(screen.getByText('Pagar con Mercado Pago')).toBeInTheDocument();
      expect(screen.getByText('Pagar en efectivo')).toBeInTheDocument();
      expect(screen.getByText('Pagar por transferencia')).toBeInTheDocument();
    });

    // Also shows "Vaciar carrito" button
    expect(screen.getByText('Vaciar carrito')).toBeInTheDocument();
  });
});
