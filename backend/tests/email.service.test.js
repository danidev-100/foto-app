/**
 * EmailService tests.
 *
 * Tests:
 *  - Send email with configured SMTP (nodemailer mocked)
 *  - Graceful fallback when SMTP not configured
 *  - sendEmail returns expected shape
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock nodemailer FIRST — before importing the module under test
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

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module registry so each test gets a fresh EmailService
    vi.resetModules();
  });

  it('creates a transporter when SMTP is configured', async () => {
    // Set SMTP env vars before importing
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'app-password';
    process.env.EMAIL_FROM = 'test@gmail.com';

    const { EmailService } = await import('../src/services/email.service.js');
    const emailService = new EmailService();

    expect(emailService.transporter).toBeDefined();
  });

  it('does NOT create a transporter when SMTP is not configured', async () => {
    // Clear SMTP env vars
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { EmailService } = await import('../src/services/email.service.js');
    const emailService = new EmailService();

    expect(emailService.transporter).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('SMTP no configurado')
    );

    warnSpy.mockRestore();
  });

  it('sendEmail rejects gracefully when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PASS;

    const { EmailService } = await import('../src/services/email.service.js');
    const emailService = new EmailService();

    await expect(
      emailService.sendEmail({ to: 'test@test.com', subject: 'Test', html: '<p>Hi</p>' })
    ).rejects.toThrow('SMTP no configurado');
  });

  it('sendEmail calls nodemailer sendMail with correct params', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'app-password';
    process.env.EMAIL_FROM = 'test@gmail.com';

    mockSendMail.mockResolvedValueOnce({ messageId: 'abc123' });

    const { EmailService } = await import('../src/services/email.service.js');
    const emailService = new EmailService();

    const result = await emailService.sendEmail({
      to: 'student@example.com',
      subject: 'Recuperación de contraseña',
      html: '<p>Reset link</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'test@gmail.com',
      to: 'student@example.com',
      subject: 'Recuperación de contraseña',
      html: '<p>Reset link</p>',
    });
    expect(result).toEqual({ messageId: 'abc123' });
  });

  it('sendResetEmail builds a reset link and calls sendEmail', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'app-password';
    process.env.EMAIL_FROM = 'test@gmail.com';
    process.env.FRONTEND_URL = 'http://localhost:80';

    mockSendMail.mockResolvedValueOnce({ messageId: 'abc123' });

    const { EmailService } = await import('../src/services/email.service.js');
    const emailService = new EmailService();

    await emailService.sendResetEmail('student@example.com', 'reset-token-123');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'student@example.com',
        subject: expect.stringContaining('Recuperación'),
        html: expect.stringContaining('reset-token-123'),
      })
    );
  });
});
