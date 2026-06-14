import { useState, useEffect, useRef } from 'react';
import { getOrders, cancelOrder, initiatePayment, setPaymentReference } from '../api/orders';
import api from '../api/client';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import { useToast } from '../components/ToastProvider';

const statusConfig = {
  pending: { label: 'Pendiente', className: 'badge bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400 dark:ring-amber-700' },
  ready: { label: 'Listo', className: 'badge bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 ring-1 ring-blue-400 dark:ring-blue-700' },
  delivered: { label: 'Entregado', className: 'badge bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 ring-1 ring-green-400 dark:ring-green-700' },
  cancelled: { label: 'Cancelado', className: 'badge bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800' },
};

const methodLabels = {
  mercadopago: 'Mercado Pago',
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mpStatus, setMpStatus] = useState(null); // 'success' | 'failure' | 'pending'
  const [actionLoading, setActionLoading] = useState(null);
  const [transferSuccess, setTransferSuccess] = useState(null); // { orderId }
  const [bankDetails, setBankDetails] = useState(null);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentRefSaving, setPaymentRefSaving] = useState(false);
  const [paymentRefSaved, setPaymentRefSaved] = useState(false);
  const [paymentRefError, setPaymentRefError] = useState('');
  const pollRef = useRef(null);
  const toast = useToast();

  const loadOrders = async (quiet) => {
    if (!quiet) setLoading(true);
    try {
      const { data } = await getOrders();
      const flat = (data.data || []).map(d => ({
        ...d.order,
        items: d.items || []
      }));
      if (flat.length > 0) {
        const raw = flat[0].createdAt;
        console.log('[Orders] createdAt:', { type: typeof raw, constructor: raw?.constructor?.name, value: raw, isDate: raw instanceof Date, parsed: parseDate(raw) });
      }
      setOrders(flat);
      // If polling for MP success and orders appeared, stop polling
      if (pollRef.current && flat.length > 0) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setMpStatus(null);
      }
      return flat;
    } finally {
      setLoading(false);
    }
  };

  // Hide transfer orders until admin confirms the payment
  const visibleOrders = orders.filter(
    (o) => !(o.paymentMethod === 'transfer' && o.paymentStatus !== 'paid')
  );
  const hasUnconfirmedTransfer = orders.some(
    (o) => o.paymentMethod === 'transfer' && o.paymentStatus !== 'paid'
  );

  useEffect(() => {
    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const transferSuccessVal = params.get('transfer_success');
    const orderId = params.get('order_id');

    if (transferSuccessVal === 'true' && orderId) {
      setTransferSuccess({ orderId });
      window.history.replaceState({}, '', '/orders');
      // Fetch bank details
      api.get('/config/bank-details').then(({ data }) => {
        setBankDetails(data.data || data);
        setBankModalOpen(true);
      }).catch(() => {
        toast.error('Error al cargar datos bancarios');
      });
      loadOrders();
      return;
    }

    // Check MP redirect param
    const redirect = params.get('mp_redirect');

    if (redirect === 'success') {
      setMpStatus('success');
      // Clean URL
      window.history.replaceState({}, '', '/orders');
      // Load orders and poll until the webhook creates the order
      loadOrders().then((flat) => {
        if (flat.length === 0) {
          pollRef.current = setInterval(async () => {
            const result = await loadOrders(true);
            if (result.length > 0) {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setMpStatus(null);
            }
          }, 2000);
        }
      });
    } else if (redirect === 'failure') {
      setMpStatus('failure');
      window.history.replaceState({}, '', '/orders');
      loadOrders();
    } else {
      loadOrders();
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCancel = async (id) => {
    setActionLoading(`cancel-${id}`);
    try {
      await cancelOrder(id);
      const { data } = await getOrders();
      const flat = (data.data || []).map(d => ({
        ...d.order,
        items: d.items || []
      }));
      setOrders(flat);
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

  const handleSavePaymentRef = async () => {
    const ref = paymentRef.trim();
    if (!ref) {
      setPaymentRefError('Ingresá el número de comprobante');
      return;
    }
    if (!transferSuccess?.orderId) return;
    setPaymentRefSaving(true);
    setPaymentRefError('');
    try {
      await setPaymentReference(transferSuccess.orderId, ref);
      setPaymentRefSaved(true);
      toast.success('Comprobante registrado con éxito');
    } catch {
      setPaymentRefError('Error al guardar el comprobante');
    } finally {
      setPaymentRefSaving(false);
    }
  };

  const toNum = (val) => (val === null || val === undefined ? 0 : Number(val));
  const formatPrice = (cents) => `$${(toNum(cents) / 100).toLocaleString('es-AR')}`;
  const parseDate = (val) => {
    if (!val) return null;
    // Already a valid Date
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    // ISO string
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
      // Try parsing as number (timestamp in ms)
      const num = Number(val);
      if (!isNaN(num)) {
        const d2 = new Date(num);
        if (!isNaN(d2.getTime())) return d2;
      }
    }
    // Number (timestamp)
    if (typeof val === 'number' && !isNaN(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
    // Object with value/iso/toISOString (Prisma serialization edge case)
    if (typeof val === 'object') {
      if (typeof val.toISOString === 'function') return val;
      if (val.value) return parseDate(val.value);
      if (val.iso) return parseDate(val.iso);
    }
    return null;
  };

  const formatDate = (date) => {
    const d = parseDate(date);
    if (!d) return '—';
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (date) => {
    const d = parseDate(date);
    if (!d) return '—';
    return d.toLocaleString('es-AR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading && mpStatus !== 'success') {
    return <Loading variant="spinner" className="py-20" />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Mis Pedidos</h1>
        <p className="mt-1 text-surface-500 dark:text-surface-400">Seguimiento de tus encargos de cuadernillos.</p>
      </div>

      {mpStatus === 'success' && visibleOrders.length === 0 && !hasUnconfirmedTransfer && (
        <div className="card p-6 mb-6 text-center">
          <Loading variant="spinner" />
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mt-4">Procesando tu pago...</h3>
          <p className="mt-1 text-surface-500 dark:text-surface-400">
            El pago se realizó con éxito. Estamos verificando la transacción, en unos segundos aparecerá tu pedido.
          </p>
        </div>
      )}

      {mpStatus === 'failure' && (
        <div className="card p-6 mb-6 border-red-200 dark:border-red-800 text-center">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">El pago no se pudo completar</h3>
          <p className="mt-1 text-surface-500 dark:text-surface-400">
            El pago con Mercado Pago no se realizó. No se creó ningún pedido.
            {visibleOrders.length === 0 && !hasUnconfirmedTransfer && ' Volvé al catálogo para intentar de nuevo.'}
          </p>
          {visibleOrders.length === 0 && !hasUnconfirmedTransfer && (
            <button onClick={() => window.location.href = '/'} className="btn-primary mt-6">
              Ver cuadernillos
            </button>
          )}
        </div>
      )}

      {visibleOrders.length === 0 && !mpStatus ? (
        hasUnconfirmedTransfer ? (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Transferencia pendiente</h3>
            <p className="mt-2 text-surface-500 dark:text-surface-400 max-w-sm mx-auto">
              El pedido se va a activar automáticamente cuando el administrador confirme la transferencia.
            </p>
            <button onClick={() => window.location.href = '/'} className="btn-primary mt-6">
              Ver cuadernillos
            </button>
          </div>
        ) : (
          <EmptyState
            message="No tenés pedidos aún"
            description="Encargá tus cuadernillos desde el catálogo."
            action={{ label: 'Ver cuadernillos', onClick: () => window.location.href = '/' }}
          />
        )
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const showPayButton = order.paymentMethod === 'mercadopago' && order.paymentStatus !== 'paid' && order.status !== 'cancelled';
            const showCancelButton = order.status === 'pending';
            const isLoading = actionLoading === `cancel-${order.id}` || actionLoading === `pay-${order.id}`;

            return (
              <div key={order.id} className="card overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">Pedido #{order.id.slice(0, 8)}</span>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Encargado: {formatDateTime(order.createdAt)}</p>
                    {order.deliveredAt && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Entregado: {formatDateTime(order.deliveredAt)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="info" size="sm">{methodLabels[order.paymentMethod] || order.paymentMethod}</Badge>
                   
                    <Badge variant={order.status === 'pending' ? 'warning' : order.status === 'ready' ? 'info' : order.status === 'delivered' ? 'success' : 'error'}>{status.label}</Badge>
                  </div>
                </div>

                {/* Items */}
                <div className="px-5 py-4">
                  <div className="space-y-3">
                    {order.items?.map((item) => {
                      const itemStatus = statusConfig[item.status] || statusConfig.pending;
                      return (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-surface-100 dark:bg-surface-700 rounded-lg flex items-center justify-center">
                              <span className="text-sm font-medium text-surface-500 dark:text-surface-400">{item.quantity}x</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-surface-700 dark:text-surface-300">{item.title}</span>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{formatPrice(item.unitPrice * item.quantity)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 bg-surface-50 dark:bg-surface-800/50 flex items-center justify-between">
                  <span className="text-lg font-bold text-surface-900 dark:text-surface-100">{formatPrice(order.total)}</span>
                  {(showPayButton || showCancelButton) && (
                    <div className="flex gap-2 flex-wrap">
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

      {/* ── Bank Details Modal ── */}
      <Modal
        isOpen={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        title="Datos para la transferencia"
        size="md"
        footer={
          <button
            onClick={() => setBankModalOpen(false)}
            className="btn-primary"
          >
            Entendido
          </button>
        }
      >
        {bankDetails ? (
          <div className="space-y-4">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                Transferí el importe exacto del pedido a la siguiente cuenta y el administrador lo confirmará manualmente.
              </p>
            </div>
            <div className="space-y-3">
              <CopyField label="Banco" value={bankDetails.bankName} />
              <CopyField label="CBU" value={bankDetails.cbu} />
              <CopyField label="Alias" value={bankDetails.alias} />
              <CopyField label="Titular" value={bankDetails.holder} />
              <CopyField label="CUIT" value={bankDetails.cuit} />
            </div>
            <p className="text-xs text-surface-400 dark:text-surface-500 text-center pt-2">
              Pedido #{transferSuccess?.orderId?.slice(0, 8) || ''}
            </p>
          </div>
        ) : (
          <Loading variant="spinner" className="py-8" />
        )}
      </Modal>

      {/* ── Payment Reference Form ── */}
      {transferSuccess && !bankModalOpen && !paymentRefSaved && (
        <div className="card p-6 mt-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
            Registrá tu comprobante
          </h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
            Ingresá el número de comprobante o referencia de la transferencia para que el administrador pueda verificarlo.
          </p>
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => { setPaymentRef(e.target.value); setPaymentRefError(''); }}
                className={`input-field ${paymentRefError ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                placeholder="Ej: 1234567890"
                disabled={paymentRefSaving}
              />
              {paymentRefError && (
                <p className="text-xs text-red-500 mt-1">{paymentRefError}</p>
              )}
            </div>
            <button
              onClick={handleSavePaymentRef}
              disabled={paymentRefSaving}
              className="btn-primary min-h-[44px]"
            >
              {paymentRefSaving ? 'Guardando...' : 'Enviar comprobante'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyField({ label, value }) {
  const toast = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value || '');
      toast.success(`${label} copiado`);
    } catch {
      toast.error('Error al copiar');
    }
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate mt-0.5">{value || '—'}</p>
      </div>
      <button
        onClick={handleCopy}
        className="ml-3 px-3 py-1.5 text-xs font-medium rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors shrink-0 min-h-[44px] inline-flex items-center ring-1 ring-primary-200 dark:ring-primary-800"
      >
        Copiar
      </button>
    </div>
  );
}
