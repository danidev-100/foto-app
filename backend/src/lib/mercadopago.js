import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

export class MercadoPagoGateway {
  constructor(accessToken, sandbox = true) {
    this.client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 10000 },
    });
    this.preference = new Preference(this.client);
    this.payment = new Payment(this.client);
    this.sandbox = sandbox;
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
