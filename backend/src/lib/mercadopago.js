import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import crypto from 'crypto';

export class MercadoPagoGateway {
  constructor(accessToken, sandbox = true, webhookSecret = '') {
    this.client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 10000 },
    });
    this.preference = new Preference(this.client);
    this.payment = new Payment(this.client);
    this.sandbox = sandbox;
    this.webhookSecret = webhookSecret;
  }

  /**
   * Validate Mercado Pago webhook X-Signature header.
   * Uses HMAC-SHA256 with the webhook secret (configured in MP dashboard).
   * Reference: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
   */
  validateWebhookSignature(headers, rawBody) {
    const xSignature = headers['x-signature'];
    const xRequestId = headers['x-request-id'];
    if (!xSignature || !xRequestId) {
      // If no webhook secret is configured, skip validation (dev mode)
      if (!this.webhookSecret) return true;
      return false;
    }

    // Parse X-Signature: ts=...,v1=...
    const parts = {};
    xSignature.split(',').forEach(p => {
      const [key, val] = p.trim().split('=');
      if (key && val) parts[key.trim()] = val.trim();
    });

    const ts = parts['ts'];
    const hash = parts['v1'];
    if (!ts || !hash) return false;

    // Build manifest: "id:{data.id};request-id:{x-request-id};ts:{ts};"
    let dataId;
    try {
      const body = JSON.parse(rawBody);
      dataId = body.data?.id;
    } catch { return false; }
    if (!dataId) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    const expectedHash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(manifest)
      .digest('hex')
      .toLowerCase();

    return hash.toLowerCase() === expectedHash;
  }

  async createPreference(externalRef, items, backURLs = {}) {
    const mpItems = items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unit_price: Number(item.unitPrice),
      currency_id: item.currencyId || 'ARS',
    }));

    const body = {
      items: mpItems,
      external_reference: externalRef,
      binary_mode: true,
      back_urls: {
        success: backURLs.success || '',
        pending: backURLs.pending || '',
        failure: backURLs.failure || '',
      },
    };

    const result = await this.preference.create({ body });
    const initPoint = this.sandbox && result.sandbox_init_point
      ? result.sandbox_init_point
      : result.init_point;

    return {
      id: result.id,
      initPoint,
    };
  }

  async getPaymentInfo(paymentId) {
    const result = await this.payment.get({ id: String(paymentId) });
    return {
      id: parseInt(result.id, 10),
      status: result.status,
      statusDetail: result.status_detail,
      externalReference: result.external_reference,
      transactionAmount: result.transaction_amount,
    };
  }
}

/**
 * Singleton gateway — initialized once by server.js, importable from anywhere.
 */
let _gateway = null;

export function initGateway(accessToken, sandbox, webhookSecret) {
  _gateway = new MercadoPagoGateway(accessToken, sandbox, webhookSecret);
  return _gateway;
}

export function getGateway() {
  if (!_gateway) throw new Error('MercadoPagoGateway not initialized — call initGateway first');
  return _gateway;
}
