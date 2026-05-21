import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_001', message: 'authentication required' },
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_001', message: 'invalid authorization header format' },
    });
  }

  try {
    const claims = jwt.verify(parts[1], config.jwtSecret);
    req.studentId = claims.student_id;
    req.email = claims.email;
    req.courseId = claims.course_id;
    req.isAdmin = claims.is_admin;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_001', message: 'invalid or expired token' },
    });
  }
}

export function adminMiddleware(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({
      success: false,
      error: { code: 'AUTH_002', message: 'insufficient permissions' },
    });
  }
  next();
}
