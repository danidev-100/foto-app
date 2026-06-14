import { useState, useEffect } from 'react';
import { getCart, updateCartItem, removeFromCart, clearCart } from '../api/cart';
import { placeOrder, initMPCheckout } from '../api/orders';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import EmptyState from '../components/EmptyState';
import Loading from '../components/Loading';

export default function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

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

  const handleCheckout = async (method) => {
    setProcessing(true);
    try {
      if (method === 'mercadopago') {
        // NEW: Init MP checkout WITHOUT creating an order first.
        // Order is only created by the webhook when MP confirms payment.
        // If payment fails, no order is ever created — cart stays intact.
        const res = await initMPCheckout();
        const paymentUrl = res.data.data.paymentUrl;
        if (paymentUrl) {
          window.location.href = paymentUrl;
        } else {
          navigate('/orders');
        }
        return;
      }

      // Cash / Transfer: create order first (admin confirms payment manually)
      const res = await placeOrder({ payment_method: method });
      if (method === 'transfer') {
        const orderId = res.data?.data?.id || '';
        navigate(`/orders?transfer_success=true&order_id=${orderId}`);
      } else {
        navigate('/orders');
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      const msg = error?.response?.data?.error?.message || error.message || 'Error al procesar el pago';
      toast.error(msg);
      setProcessing(false);
    }
  };

  const toNum = (val) => (val === null || val === undefined ? 0 : Number(val));
  const formatPrice = (cents) => `$${(toNum(cents) / 100).toLocaleString('es-AR')}`;

  if (loading) {
    return <Loading variant="spinner" className="py-20" />;
  }

  if (!cart?.items?.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <EmptyState
          message="Tu carrito está vacío"
          description="Explorá los cuadernillos disponibles y agregá los que necesités."
          action={{ label: 'Ver cuadernillos', onClick: () => navigate('/') }}
        />
      </div>
    );
  }

  const total = cart.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Mi Carrito</h1>
          <p className="mt-1 text-surface-500">{cart.items.length} {cart.items.length === 1 ? 'item' : 'items'}</p>
        </div>
        <button onClick={() => clearCart().then(() => getCart().then(({ data }) => setCart(data.data)))} className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 ring-red-200">
          Vaciar carrito
        </button>
      </div>

      <div className="space-y-4">
        {cart.items.map((item) => (
          <div key={item.id} className="card p-5">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              {/* Thumbnail */}
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-primary-400 dark:text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-surface-900 dark:text-surface-100 truncate">{item.title}</h3>
                <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">{formatPrice(item.unitPrice)} c/u</p>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(item.bookletId, item.quantity - 1)}
                    disabled={updating === item.bookletId}
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 flex items-center justify-center text-surface-600 dark:text-surface-300 transition-colors disabled:opacity-50"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium text-sm text-surface-900 dark:text-surface-100">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.bookletId, item.quantity + 1)}
                    disabled={updating === item.bookletId}
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 flex items-center justify-center text-surface-600 dark:text-surface-300 transition-colors disabled:opacity-50"
                >
                  +
                </button>
                <button
                    onClick={() => remove(item.bookletId)}
                  className="ml-2 min-w-[44px] min-h-[44px] rounded-lg text-surface-400 dark:text-surface-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Subtotal */}
            <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 flex justify-end">
              <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Subtotal: {formatPrice(item.unitPrice * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-6">
          <span className="text-surface-600 dark:text-surface-400">Total</span>
          <span className="text-2xl font-bold text-surface-900 dark:text-surface-100">{formatPrice(total)}</span>
        </div>

        <div className="space-y-3">
          {/* Mercado Pago Button */}
          <button
            onClick={() => handleCheckout('mercadopago')}
            disabled={processing}
            className="w-full flex items-center justify-center gap-3 bg-[#009EE3] hover:bg-[#0088C2] text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            Pagar con Mercado Pago
          </button>

          {/* Cash Button */}
          <button
            onClick={() => handleCheckout('cash')}
            disabled={processing}
            className="w-full flex items-center justify-center gap-3 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-200 font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-surface-200 dark:ring-surface-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Pagar en efectivo
          </button>

          {/* Transfer Button */}
          <button
            onClick={() => handleCheckout('transfer')}
            disabled={processing}
            className="w-full flex items-center justify-center gap-3 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-indigo-200 dark:ring-indigo-800"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Pagar por transferencia
          </button>
        </div>

        <p className="mt-4 text-xs text-center text-surface-400 dark:text-surface-500">
          {processing ? 'Procesando tu orden...' : 'Elegí tu método de pago preferido.'}
        </p>
      </div>
    </div>
  );
}
