import { useState, useEffect } from 'react';
import { getOrders, cancelOrder, initiatePayment } from '../api/orders';
import api from '../api/client';

const statusConfig = {
  pending: { label: 'Pendiente', className: 'badge bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400 dark:ring-amber-700' },
  ready: { label: 'Listo', className: 'badge bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 ring-1 ring-blue-400 dark:ring-blue-700' },
  delivered: { label: 'Entregado', className: 'badge bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 ring-1 ring-green-400 dark:ring-green-700' },
  cancelled: { label: 'Cancelado', className: 'badge bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800' },
};

const paymentConfig = {
  pending: { label: 'Pendiente', className: 'badge bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400' },
  approved: { label: 'Pagado', className: 'badge bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800' },
  rejected: { label: 'Rechazado', className: 'badge bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800' },
};

const methodLabels = {
  mercadopago: 'Mercado Pago',
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);

  useEffect(() => {
    getOrders().then(({ data }) => {
      // Backend returns { order, items } structure, flatten to include items in order
      const orders = (data.data || []).map(d => ({
        ...d.order,
        items: d.items || []
      }));
      setOrders(orders);
    }).finally(() => setLoading(false));

    // Fetch bank details for transfer orders
    api.get('/config/bank-details').then(({ data }) => {
      if (data?.data) setBankDetails(data.data);
    }).catch(() => {});
  }, []);

  const handleCancel = async (id) => {
    setActionLoading(`cancel-${id}`);
    try {
      await cancelOrder(id);
      const { data } = await getOrders();
      setOrders(data.data || []);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePay = async (id) => {
    setActionLoading(`pay-${id}`);
    try {
      const { data } = await initiatePayment(id, 'mercadopago');
      const paymentUrl = data.data?.paymentUrl || data.data?.preference_url;
      if (paymentUrl) {
        window.location.href = paymentUrl;
      }
    } finally {
      setActionLoading(null);
    }
  };

  const toNum = (val) => (val === null || val === undefined ? 0 : Number(val));
  const formatPrice = (cents) => `$${(toNum(cents) / 100).toLocaleString('es-AR')}`;
  const formatDate = (date) => new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Mis Pedidos</h1>
        <p className="mt-1 text-surface-500 dark:text-surface-400">Seguimiento de tus encargos de cuadernillos.</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-surface-400 dark:text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">No tenés pedidos aún</h3>
          <p className="mt-1 text-surface-500 dark:text-surface-400">Encargá tus cuadernillos desde el catálogo.</p>
          <button onClick={() => window.location.href = '/'} className="btn-primary mt-6">
            Ver cuadernillos
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const payment = paymentConfig[order.payment_status] || paymentConfig.pending;
            const showPayButton = order.payment_method === 'mercadopago' && order.payment_status !== 'paid';
            const showCancelButton = order.status === 'pending';
            const isLoading = actionLoading === `cancel-${order.id}` || actionLoading === `pay-${order.id}`;

            return (
              <div key={order.id} className="card overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">Pedido #{order.id.slice(0, 8)}</span>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-200 text-xs">
                      {methodLabels[order.payment_method] || order.payment_method}
                    </span>
                    <span className={payment.className}>{payment.label}</span>
                    <span className={status.className}>{status.label}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="px-5 py-4">
                  <div className="space-y-3">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-surface-100 dark:bg-surface-700 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-medium text-surface-500 dark:text-surface-400">{item.quantity}x</span>
                          </div>
                          <span className="text-sm text-surface-700 dark:text-surface-300">{item.title}</span>
                        </div>
                        <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{formatPrice(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bank transfer info */}
                {order.payment_method === 'transfer' && order.payment_status === 'pending' && bankDetails && (
                  <div className="mx-5 mb-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl ring-1 ring-primary-200 dark:ring-primary-800">
                    <h4 className="text-sm font-semibold text-primary-800 dark:text-primary-300 mb-2">
                      Datos para la transferencia
                    </h4>
                    <div className="text-xs text-primary-700 dark:text-primary-400 space-y-1">
                      <p><span className="font-medium">Banco:</span> {bankDetails.bankName}</p>
                      <p><span className="font-medium">Titular:</span> {bankDetails.holder}</p>
                      <p><span className="font-medium">CUIT:</span> {bankDetails.cuit}</p>
                      <p><span className="font-medium">CBU:</span> <span className="select-all font-mono">{bankDetails.cbu}</span></p>
                      <p><span className="font-medium">ALIAS:</span> <span className="select-all font-mono">{bankDetails.alias}</span></p>
                    </div>
                    <p className="mt-2 text-xs text-primary-600 dark:text-primary-500">
                      Transferí el total del pedido y compartinos el comprobante. Apenas lo recibamos, lo marcamos como pagado.
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="px-5 py-4 bg-surface-50 dark:bg-surface-800/50 flex items-center justify-between">
                  <span className="text-lg font-bold text-surface-900 dark:text-surface-100">{formatPrice(order.total)}</span>
                  {(showPayButton || showCancelButton) && (
                    <div className="flex gap-2">
                      {showPayButton && (
                        <button
                          onClick={() => handlePay(order.id)}
                          disabled={isLoading}
                          className="btn-primary text-sm"
                        >
                          {isLoading ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : 'Pagar con MP'}
                        </button>
                      )}
                      {showCancelButton && (
                        <button
                          onClick={() => handleCancel(order.id)}
                          disabled={isLoading}
                          className="btn-secondary text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 ring-red-200 dark:ring-red-800"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
