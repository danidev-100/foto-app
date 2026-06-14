/**
 * Email templates — pure functions returning HTML strings.
 *
 * Each returns a complete, responsive HTML email with inline styles.
 * Spanish text, minimal FotoApp branding, school-appropriate tone.
 * No template engine dependency.
 */

/**
 * Order confirmation — sent when a student places an order (cash/transfer).
 * @param {string} studentName
 * @param {string} orderId
 * @param {number} total
 * @param {string} paymentMethod — 'cash' | 'transfer' | 'mercadopago'
 * @returns {string} HTML
 */
export function orderConfirmation(studentName, orderId, total, paymentMethod) {
  const methodLabel = paymentMethod === 'cash' ? 'efectivo'
    : paymentMethod === 'transfer' ? 'transferencia bancaria'
    : paymentMethod;

  const methodNote = paymentMethod === 'cash'
    ? 'Recordá abonar en efectivo al retirar tu pedido.'
    : paymentMethod === 'transfer'
      ? 'Recordá realizar la transferencia y el administrador confirmará el pago.'
      : '';

  return /* html */`
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: #2563eb; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">¡Pedido Confirmado!</h1>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.5;">Hola <strong>${escapeHtml(studentName)}</strong>,</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.5;">Recibimos tu pedido <strong>#${escapeHtml(orderId)}</strong> y lo estamos preparando.</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.5;">
          Método de pago: <strong>${methodLabel}</strong><br>
          Total: <strong>$${Number(total).toLocaleString('es-AR')}</strong>
        </p>
        ${methodNote ? `<p style="color: #6b7280; font-size: 14px; line-height: 1.5;">${methodNote}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">FotoApp · Tu tienda de cuadernillos</p>
      </div>
    </div>
  `;
}

/**
 * Order ready for pickup — sent when admin marks order as 'ready'.
 * @param {string} studentName
 * @param {string} orderId
 * @returns {string} HTML
 */
export function orderReady(studentName, orderId) {
  return /* html */`
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: #16a34a; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Listo para Retirar</h1>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.5;">Hola <strong>${escapeHtml(studentName)}</strong>,</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.5;">Tu pedido <strong>#${escapeHtml(orderId)}</strong> ya está listo. Pasá a retirarlo por la fotocopiadora.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">FotoApp · Tu tienda de cuadernillos</p>
      </div>
    </div>
  `;
}

/**
 * Order delivered — sent when admin marks order as 'delivered'.
 * @param {string} studentName
 * @param {string} orderId
 * @returns {string} HTML
 */
export function orderDelivered(studentName, orderId) {
  return /* html */`
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: #16a34a; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Pedido Entregado</h1>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.5;">Hola <strong>${escapeHtml(studentName)}</strong>,</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.5;">Tu pedido <strong>#${escapeHtml(orderId)}</strong> fue entregado. ¡Gracias por comprar en FotoApp!</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">FotoApp · Tu tienda de cuadernillos</p>
      </div>
    </div>
  `;
}

/**
 * Payment confirmed — sent when admin confirms a cash or transfer payment.
 * @param {string} studentName
 * @param {string} orderId
 * @param {string} method — 'cash' | 'transfer'
 * @returns {string} HTML
 */
export function paymentConfirmed(studentName, orderId, method) {
  const methodLabel = method === 'cash' ? 'efectivo' : 'transferencia';

  return /* html */`
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: #2563eb; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Pago Confirmado</h1>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.5;">Hola <strong>${escapeHtml(studentName)}</strong>,</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.5;">El pago de tu pedido <strong>#${escapeHtml(orderId)}</strong> fue confirmado.</p>
        <p style="color: #374151; font-size: 15px;">Método: <strong>${methodLabel}</strong></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">FotoApp · Tu tienda de cuadernillos</p>
      </div>
    </div>
  `;
}

/**
 * Minimal HTML escape to prevent injection in rendered emails.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
