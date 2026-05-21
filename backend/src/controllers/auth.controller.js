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
}
