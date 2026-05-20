import api from './client';

export const getOrders = (params) => api.get('/orders', { params });
export const getOrder = (id) => api.get(`/orders/${id}`);
export const placeOrder = (body) => api.post('/orders', body);
export const cancelOrder = (id) => api.post(`/orders/${id}/cancel`);
export const initiatePayment = (orderId, method) =>
  api.post(`/orders/${orderId}/pay`, { method });
