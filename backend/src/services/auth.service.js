import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

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
    return { token, student: this.sanitizeStudent(student) };
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
    return { token, student: this.sanitizeStudent(student) };
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

  sanitizeStudent(student) {
    const { passwordHash, ...rest } = student;
    return rest;
  }
}
