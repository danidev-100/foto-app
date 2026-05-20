import { useState, useEffect } from 'react';
import { getCart, updateCartItem, removeFromCart, clearCart } from '../api/cart';
import { placeOrder } from '../api/orders';
import { useNavigate } from 'react-router-dom';

export default function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getCart().then(({ data }) => setCart(data.data)).finally(() => setLoading(false));
  }, []);

  const updateQty = async (id, qty) => {
    if (qty < 1) return;
    setUpdating(id);
    try {
      await updateCartItem(id, qty);
      const { data } = await getCart();
      setCart(data.data);
    } finally {
      setUpdating(null);
    }
  };

  const remove = async (id) => {
    await removeFromCart(id);
    const { data } = await getCart();
    setCart(data.data);
  };

  const handleCheckout = async () => {
    await placeOrder();
    navigate('/orders');
  };

  const formatPrice = (cents) => `$${(cents / 100).toLocaleString('es-AR')}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-surface-900">Tu carrito está vacío</h3>
        <p className="mt-1 text-surface-500">Explorá los cuadernillos disponibles y agregá los que necesités.</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-6">
          Ver cuadernillos
        </button>
      </div>
    );
  }

  const total = cart.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Mi Carrito</h1>
          <p className="mt-1 text-surface-500">{cart.items.length} {cart.items.length === 1 ? 'item' : 'items'}</p>
        </div>
        <button onClick={clearCart} className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 ring-red-200">
          Vaciar carrito
        </button>
      </div>

      <div className="space-y-4">
        {cart.items.map((item) => (
          <div key={item.id} className="card p-5">
            <div className="flex items-start gap-4">
              {/* Thumbnail */}
              <div className="w-16 h-16 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-surface-900 truncate">{item.title}</h3>
                <p className="text-sm text-surface-500 mt-0.5">{formatPrice(item.unit_price)} c/u</p>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQty(item.booklet_id, item.quantity - 1)}
                  disabled={updating === item.booklet_id}
                  className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 flex items-center justify-center text-surface-600 transition-colors disabled:opacity-50"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQty(item.booklet_id, item.quantity + 1)}
                  disabled={updating === item.booklet_id}
                  className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 flex items-center justify-center text-surface-600 transition-colors disabled:opacity-50"
                >
                  +
                </button>
                <button
                  onClick={() => remove(item.booklet_id)}
                  className="ml-2 w-8 h-8 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Subtotal */}
            <div className="mt-3 pt-3 border-t border-surface-100 flex justify-end">
              <span className="text-sm font-medium text-surface-700">
                Subtotal: {formatPrice(item.unit_price * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-surface-600">Total</span>
          <span className="text-2xl font-bold text-surface-900">{formatPrice(total)}</span>
        </div>
        <button onClick={handleCheckout} className="btn-primary w-full text-base py-3">
          Encargar cuadernillos
        </button>
        <p className="mt-3 text-xs text-center text-surface-400">
          Podés pagar con Mercado Pago o en efectivo al retirar.
        </p>
      </div>
    </div>
  );
}
