import api from './client';

export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const getProfile = () => api.get('/auth/profile');
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = ({ token, newPassword }) => api.post('/auth/reset-password', { token, newPassword });
export const refreshToken = (refresh) => api.post('/auth/refresh', { refreshToken: refresh });
