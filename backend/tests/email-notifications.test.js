/**
 * Email notification templates tests.
 *
 * Tests:
 *  - orderConfirmation template renders order details
 *  - orderReady template renders pickup info
 *  - orderDelivered template renders completion
 *  - paymentConfirmed template renders payment info
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock nodemailer — same as email.service.test.js
const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
  createTransport: vi.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

describe('Email notification templates', () => {
  let EmailService;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'pass';
    process.env.EMAIL_FROM = 'test@test.com';
    process.env.FRONTEND_URL = 'http://localhost:80';

    const mod = await import('../src/services/email.service.js');
    EmailService = mod.EmailService;
  });

  it('sendOrderConfirmation sends email with order details', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'abc' });
    const svc = new EmailService();

    await svc.sendOrderConfirmation('student@test.com', {
      orderId: 'ord-123',
      total: 2500,
      items: [
        { title: 'Cuadernillo 1', quantity: 2, unitPrice: 500 },
        { title: 'Cuadernillo 2', quantity: 1, unitPrice: 1500 },
      ],
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('student@test.com');
    expect(call.subject).toContain('Pedido Confirmado');
    // HTML should include order details
    expect(call.html).toContain('ord-123');
    expect(call.html).toContain('Cuadernillo 1');
    expect(call.html).toContain('$2.500');
  });

  it('sendOrderReady sends email with ready status', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'abc' });
    const svc = new EmailService();

    await svc.sendOrderReady('student@test.com', {
      orderId: 'ord-456',
      studentName: 'Juan Pérez',
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('Listo');
    expect(call.html).toContain('Listo para Retirar');
    expect(call.html).toContain('ord-456');
    expect(call.html).toContain('Juan Pérez');
  });

  it('sendOrderDelivered sends email with delivery confirmation', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'abc' });
    const svc = new EmailService();

    await svc.sendOrderDelivered('student@test.com', {
      orderId: 'ord-789',
      studentName: 'María García',
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('Entregado');
    expect(call.html).toContain('ord-789');
    expect(call.html).toContain('María García');
  });

  it('sendPaymentConfirmed sends email with payment info', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'abc' });
    const svc = new EmailService();

    await svc.sendPaymentConfirmed('student@test.com', {
      orderId: 'ord-101',
      method: 'cash',
      total: 3000,
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('Pago Confirmado');
    expect(call.html).toContain('ord-101');
    expect(call.html).toContain('efectivo');
  });

  it('sendPaymentConfirmed shows transfer method', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'abc' });
    const svc = new EmailService();

    await svc.sendPaymentConfirmed('student@test.com', {
      orderId: 'ord-202',
      method: 'transfer',
      total: 5000,
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('transferencia');
  });
});
