import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { EmailService } from './email.service.js';

export class AuthService {
  async register({ name, email, password, phone, courseId }) {
    const existing = await prisma.student.findUnique({ where: { email } });
    if (existing) {
      const err = new Error('email already registered');
      err.code = 'AUTH_003';
      err.status = 409;
      throw err;
    }

    let parsedCourseId = courseId || null;
    if (courseId) {
      try {
        parsedCourseId = courseId;
        await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
      } catch {
        const err = new Error('invalid course_id');
        err.code = 'AUTH_004';
        err.status = 400;
        throw err;
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const student = await prisma.student.create({
      data: {
        id: uuidv4(),
        name,
        email,
        passwordHash,
        phone,
        courseId: parsedCourseId,
        isAdmin: false,
        isActive: true,
      },
    });

    const token = this.generateToken(student);
    const refreshToken = await this.generateRefreshToken(student);
    return { token, refreshToken, student: this.sanitizeStudent(student) };
  }

  async login({ email, password }) {
    const student = await prisma.student.findUnique({ where: { email } });
    if (!student) {
      const err = new Error('invalid email or password');
      err.code = 'AUTH_005';
      err.status = 401;
      throw err;
    }

    const valid = await bcrypt.compare(password, student.passwordHash);
    if (!valid) {
      const err = new Error('invalid email or password');
      err.code = 'AUTH_005';
      err.status = 401;
      throw err;
    }

    const token = this.generateToken(student);
    const refreshToken = await this.generateRefreshToken(student);
    return { token, refreshToken, student: this.sanitizeStudent(student) };
  }

  /**
   * Generate a refresh token: random bytes → SHA-256 hash stored in DB.
   * Returns the raw token (to the client) — only the hash is persisted.
   */
  async generateRefreshToken(student) {
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Parse refresh expiration: '7d' → 7 days in ms
    const match = String(config.jwtRefreshExpiration).match(/^(\d+)([dhms])$/);
    let expiresInMs = 7 * 24 * 60 * 60 * 1000; // default 7d
    if (match) {
      const num = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
      expiresInMs = num * (multipliers[unit] || 86400000);
    }

    await prisma.refreshToken.create({
      data: {
        id: uuidv4(),
        studentId: student.id,
        tokenHash,
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });

    return rawToken;
  }

  /**
   * Refresh an access token using a valid refresh token.
   * Validates, rotates (revokes old + issues new), and returns a new token pair.
   */
  async refreshAccessToken({ refreshToken }) {
    if (!refreshToken) {
      const err = new Error('refreshToken is required');
      err.code = 'AUTH_004';
      err.status = 400;
      throw err;
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { student: true },
    });

    if (!stored) {
      const err = new Error('Invalid refresh token');
      err.code = 'AUTH_004';
      err.status = 401;
      throw err;
    }

    // Check if already revoked (token reuse detection)
    if (stored.revokedAt) {
      // Revoke ALL refresh tokens for this student — rotation breach
      await prisma.refreshToken.updateMany({
        where: { studentId: stored.studentId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const err = new Error('Refresh token has been revoked — possible token reuse');
      err.code = 'AUTH_004';
      err.status = 401;
      throw err;
    }

    // Check expiry
    if (new Date() > stored.expiresAt) {
      const err = new Error('Refresh token expired');
      err.code = 'AUTH_004';
      err.status = 401;
      throw err;
    }

    // Revoke the old refresh token
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // Issue new token pair
    const student = stored.student;
    const newToken = this.generateToken(student);
    const newRefreshToken = await this.generateRefreshToken(student);

    return { token: newToken, refreshToken: newRefreshToken };
  }

  generateToken(student) {
    return jwt.sign(
      {
        student_id: student.id,
        email: student.email,
        course_id: student.courseId || '',
        is_admin: student.isAdmin,
        sub: student.id,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration },
    );
  }

  /**
   * Initiate password reset flow.
   * Always returns success to prevent email enumeration.
   * Email sending is fire-and-forget — failures are logged, not exposed.
   */
  async forgotPassword(email) {
    if (!email) {
      const err = new Error('email is required');
      err.code = 'AUTH_004';
      err.status = 400;
      throw err;
    }

    const student = await prisma.student.findUnique({ where: { email } });
    if (!student) {
      // Don't reveal whether the email exists
      return { message: 'Si el email existe, recibirás un enlace de recuperación' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.resetToken.create({
      data: {
        id: uuidv4(),
        studentId: student.id,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Fire-and-forget email — failure is logged, never blocks the response
    try {
      const emailService = new EmailService();
      await emailService.sendResetEmail(student.email, rawToken);
    } catch (err) {
      console.error('[AuthService] Error sending reset email:', err.message);
    }

    return { message: 'Si el email existe, recibirás un enlace de recuperación' };
  }

  /**
   * Reset password using a valid reset token.
   */
  async resetPassword({ token, newPassword }) {
    if (!token || !newPassword) {
      const err = new Error('token and newPassword are required');
      err.code = 'AUTH_004';
      err.status = 400;
      throw err;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await prisma.resetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!resetToken) {
      const err = new Error('Token inválido');
      err.code = 'TOKEN_INVALID';
      err.status = 400;
      throw err;
    }

    if (resetToken.usedAt) {
      const err = new Error('Token ya utilizado');
      err.code = 'TOKEN_INVALID';
      err.status = 400;
      throw err;
    }

    if (new Date() > resetToken.expiresAt) {
      const err = new Error('Token expirado');
      err.code = 'TOKEN_EXPIRED';
      err.status = 400;
      throw err;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.student.update({
        where: { id: resetToken.studentId },
        data: { passwordHash },
      }),
      prisma.resetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  sanitizeStudent(student) {
    const { passwordHash, ...rest } = student;
    return rest;
  }
}
