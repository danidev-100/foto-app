import { AuthService } from '../services/auth.service.js';
import { successJSON, errorJSON } from '../lib/response.js';

const authService = new AuthService();

export class AuthController {
  async register(req, res) {
    const { name, email, password, phone, course_id: courseId } = req.body;
    if (!name || !email || !password) {
      return errorJSON(res, 400, 'AUTH_004', 'name, email, and password are required');
    }

    try {
      const result = await authService.register({ name, email, password, phone, courseId });
      return successJSON(res, 201, result);
    } catch (err) {
      if (err.code === 'AUTH_003') {
        return errorJSON(res, 409, 'AUTH_003', 'email already registered');
      }
      console.error('Register error:', err);
      return errorJSON(res, 500, 'INF_001', 'internal server error');
    }
  }

  async login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return errorJSON(res, 400, 'AUTH_004', 'email and password are required');
    }

    try {
      const result = await authService.login({ email, password });
      return successJSON(res, 200, result);
    } catch (err) {
      if (err.code === 'AUTH_005') {
        return errorJSON(res, 401, 'AUTH_005', 'invalid email or password');
      }
      return errorJSON(res, 500, 'INF_001', 'internal server error');
    }
  }

  async refresh(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return errorJSON(res, 400, 'AUTH_004', 'refreshToken is required');
    }

    try {
      const result = await authService.refreshAccessToken({ refreshToken });
      return successJSON(res, 200, result);
    } catch (err) {
      if (err.code === 'AUTH_004') {
        return errorJSON(res, err.status || 401, 'AUTH_004', err.message);
      }
      console.error('Refresh error:', err);
      return errorJSON(res, 500, 'INF_001', 'internal server error');
    }
  }

  async forgotPassword(req, res) {
    const { email } = req.body;
    if (!email) {
      return errorJSON(res, 400, 'AUTH_004', 'email is required');
    }

    try {
      const result = await authService.forgotPassword(email);
      return successJSON(res, 200, result);
    } catch (err) {
      console.error('Forgot password error:', err);
      return errorJSON(res, 500, 'INF_001', 'internal server error');
    }
  }

  async resetPassword(req, res) {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return errorJSON(res, 400, 'AUTH_004', 'token and newPassword are required');
    }

    try {
      const result = await authService.resetPassword({ token, newPassword });
      return successJSON(res, 200, result);
    } catch (err) {
      if (err.code === 'TOKEN_EXPIRED') {
        return errorJSON(res, 400, 'TOKEN_EXPIRED', 'El token ha expirado');
      }
      if (err.code === 'TOKEN_INVALID') {
        return errorJSON(res, 400, 'TOKEN_INVALID', 'Token inválido o ya utilizado');
      }
      console.error('Reset password error:', err);
      return errorJSON(res, 500, 'INF_001', 'internal server error');
    }
  }
}
