import api from './client';

export const getCart = () => api.get('/cart');
export const addToCart = (data) => api.post('/cart/items', data);
export const updateCartItem = (bookletId, quantity) =>
  api.put(`/cart/items/${bookletId}`, { quantity });
export const removeFromCart = (bookletId) =>
  api.delete(`/cart/items/${bookletId}`);
export const clearCart = () => api.delete('/cart');
