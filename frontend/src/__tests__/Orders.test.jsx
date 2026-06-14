/**
 * Orders page frontend tests.
 *
 * Covers:
 *  - Shows loading state
 *  - Shows empty state when no orders
 *  - Shows order list
 *  - Shows payment status badges
 *  - Can cancel pending order
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ToastProvider from '../components/ToastProvider';
import Orders from '../pages/Orders';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

// Mock orders API
vi.mock('../api/orders', () => ({
  getOrders: vi.fn(),
  cancelOrder: vi.fn(),
  initiatePayment: vi.fn(),
}));

// Mock client for bank-details API
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock toast — must provide default (the Provider component) AND useToast
vi.mock('../components/ToastProvider', () => ({
  default: ({ children }) => <>{children}</>,
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}));

import { getOrders, cancelOrder } from '../api/orders';
import api from '../api/client';

// Mock data
const mockOrder1 = {
  id: 'ord-001-xxxx',
  studentId: 's1',
  total: 3000,
  status: 'pending',
  paymentMethod: 'cash',
  paymentStatus: 'pending',
  createdAt: '2026-06-01T10:00:00.000Z',
  items: [
    {
      id: 'oi-1', orderId: 'ord-001-xxxx', bookletId: 'b1',
      title: 'Matemática U1', quantity: 2, unitPrice: 1500, status: 'pending',
    },
  ],
};

const mockOrder2 = {
  id: 'ord-002-yyyy',
  studentId: 's1',
  total: 2000,
  status: 'delivered',
  paymentMethod: 'mercadopago',
  paymentStatus: 'paid',
  createdAt: '2026-05-15T08:00:00.000Z',
  deliveredAt: '2026-05-20T14:00:00.000Z',
  items: [
    {
      id: 'oi-2', orderId: 'ord-002-yyyy', bookletId: 'b2',
      title: 'Lengua U1', quantity: 1, unitPrice: 2000, status: 'delivered',
    },
  ],
};

const mockOrdersData = [
  { order: mockOrder1, items: mockOrder1.items },
  { order: mockOrder2, items: mockOrder2.items },
];

function renderOrders() {
  // Mock window.location.search (no URL params)
  const originalLocation = window.location;
  delete window.location;
  window.location = { ...originalLocation, search: '', href: '', replaceState: vi.fn() };

  return render(
    <BrowserRouter>
      <ToastProvider>
        <Orders />
      </ToastProvider>
    </BrowserRouter>
  );
}

describe('Orders page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getOrders.mockImplementationOnce(() => new Promise(() => {}));

    renderOrders();

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('shows empty state when no orders', async () => {
    getOrders.mockResolvedValueOnce({ data: { data: [] } });

    renderOrders();

    await waitFor(() => {
      expect(screen.getByText('No tenés pedidos aún')).toBeInTheDocument();
    });
  });

  it('shows order list', async () => {
    getOrders.mockResolvedValueOnce({ data: { data: mockOrdersData } });

    renderOrders();

    await waitFor(() => {
      // Items from both orders
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
      expect(screen.getByText('Lengua U1')).toBeInTheDocument();
    });

    // Order IDs shown (first 8 chars)
    expect(screen.getByText(/ord-001-/)).toBeInTheDocument();
    expect(screen.getByText(/ord-002-/)).toBeInTheDocument();

    // Total amounts
    expect(screen.getByText('Mis Pedidos')).toBeInTheDocument();
  });

  it('shows payment status badges', async () => {
    getOrders.mockResolvedValueOnce({ data: { data: mockOrdersData } });

    renderOrders();

    await waitFor(() => {
      // Payment method labels
      expect(screen.getByText('Efectivo')).toBeInTheDocument();
      expect(screen.getByText('Mercado Pago')).toBeInTheDocument();
    });

    // Status badges appear per-order and per-item (at least once each)
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Entregado').length).toBeGreaterThanOrEqual(1);
  });

  it('can cancel a pending order', async () => {
    getOrders
      .mockResolvedValueOnce({ data: { data: mockOrdersData } }) // initial
      .mockResolvedValueOnce({ data: { data: [mockOrdersData[1]] } }); // after cancel

    cancelOrder.mockResolvedValueOnce({ data: { success: true } });

    renderOrders();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });

    // Find cancel buttons (the pending order has Cancelar button)
    const cancelBtns = screen.getAllByText('Cancelar');
    expect(cancelBtns.length).toBeGreaterThanOrEqual(1);

    await user.click(cancelBtns[0]);

    await waitFor(() => {
      expect(cancelOrder).toHaveBeenCalledWith(mockOrder1.id);
    });
  });
});
