import nodemailer from 'nodemailer';
import { config } from '../config.js';
import {
  orderConfirmation as orderConfirmationTemplate,
  orderReady as orderReadyTemplate,
  orderDelivered as orderDeliveredTemplate,
  paymentConfirmed as paymentConfirmedTemplate,
} from '../lib/email-templates.js';

/**
 * EmailService — Nodemailer wrapper for transactional emails.
 *
 * Creates a singleton SMTP transport when configured, or degrades gracefully.
 * All send operations are fire-and-forget: failures are logged, never thrown
 * to the caller (except when SMTP is not configured at all, which is a
 * programming error if someone calls sendEmail).
 */
export class EmailService {
  constructor() {
    this.transporter = null;
    this._init();
  }

  _init() {
    const { smtpHost, smtpPort, smtpUser, smtpPass, emailFrom } = config;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('[EmailService] SMTP no configurado — los correos no se enviarán');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    this.from = emailFrom || smtpUser;
  }

  /**
   * Send an email.
   * @param {{ to: string, subject: string, html: string }} options
   * @returns {Promise<{messageId: string}>}
   */
  async sendEmail({ to, subject, html }) {
    if (!this.transporter) {
      throw new Error('SMTP no configurado');
    }

    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
    });

    return { messageId: info.messageId };
  }

  /**
   * Send a password reset email with the reset link.
   */
  async sendResetEmail(to, token) {
    const resetUrl = `${config.frontendUrl}/reset-password/${token}`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="background: #2563eb; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">Recuperación de Contraseña</h1>
        </div>
        <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
          <p style="color: #374151; font-size: 15px; line-height: 1.5;">Hacé clic en el siguiente enlace para restablecer tu contraseña. Este enlace expira en 1 hora.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Restablecer Contraseña</a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">Si no solicitaste este cambio, ignorá este mensaje.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #9ca3af; font-size: 12px;">FotoApp · Tu tienda de cuadernillos</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'Recuperación de contraseña - FotoApp',
      html,
    });
  }

  /**
   * Send order confirmation — student just placed an order.
   * @param {string} to
   * @param {{ orderId: string, total: number, studentName?: string, paymentMethod?: string, items?: Array<{ title: string, quantity: number, unitPrice: number }> }} order
   */
  async sendOrderConfirmation(to, { orderId, total, studentName = '', paymentMethod = '', items = [] }) {
    const baseHtml = orderConfirmationTemplate(studentName, orderId, total, paymentMethod);

    const itemsHtml = items.length > 0
      ? `
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead><tr style="background: #f3f4f6;"><th style="padding: 8px; text-align: left; font-size: 14px;">Producto</th><th style="padding: 8px; text-align: center; font-size: 14px;">Cant.</th><th style="padding: 8px; text-align: right; font-size: 14px;">Precio</th></tr></thead>
          <tbody>${items.map((i) => `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${i.title}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${i.quantity}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px;">$${Number(i.unitPrice).toLocaleString('es-AR')}</td></tr>`).join('')}</tbody>
        </table>
        <p style="text-align: right; font-size: 16px; font-weight: 600; color: #374151;">Total: $${Number(total).toLocaleString('es-AR')}</p>`
      : '';

    // Insert items table after the paragraph block, before the <hr>
    const html = itemsHtml
      ? baseHtml.replace('<hr style="border: none;', `${itemsHtml}\n<hr style="border: none;`)
      : baseHtml;

    return this.sendEmail({
      to,
      subject: `Pedido Confirmado #${orderId} - FotoApp`,
      html,
    });
  }

  /**
   * Send order ready for pickup notification.
   */
  async sendOrderReady(to, { orderId, studentName }) {
    const html = orderReadyTemplate(studentName, orderId);

    return this.sendEmail({
      to,
      subject: `Pedido Listo #${orderId} - FotoApp`,
      html,
    });
  }

  /**
   * Send order delivered notification.
   */
  async sendOrderDelivered(to, { orderId, studentName }) {
    const html = orderDeliveredTemplate(studentName, orderId);

    return this.sendEmail({
      to,
      subject: `Pedido Entregado #${orderId} - FotoApp`,
      html,
    });
  }

  /**
   * Send payment confirmed notification.
   * @param {string} to
   * @param {{ orderId: string, method: string, total?: number, studentName?: string }} payment
   */
  async sendPaymentConfirmed(to, { orderId, method, studentName = '' }) {
    const html = paymentConfirmedTemplate(studentName, orderId, method);

    return this.sendEmail({
      to,
      subject: `Pago Confirmado #${orderId} - FotoApp`,
      html,
    });
  }
}
