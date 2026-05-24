import api from './client.js';

// Courses
export const adminGetCourses = () => api.get('/admin/courses');
export const adminCreateCourse = (data) => api.post('/admin/courses', data);
export const adminUpdateCourse = (id, data) => api.put(`/admin/courses/${id}`, data);
export const adminDeleteCourse = (id) => api.delete(`/admin/courses/${id}`);

// Divisions
export const adminGetDivisions = () => api.get('/admin/divisions');
export const adminCreateDivision = (data) => api.post('/admin/divisions', data);
export const adminUpdateDivision = (id, data) => api.put(`/admin/divisions/${id}`, data);
export const adminDeleteDivision = (id) => api.delete(`/admin/divisions/${id}`);

// Booklets
export const adminGetBooklets = () => api.get('/admin/booklets');
export const adminCreateBooklet = (data) => api.post('/admin/booklets', data);
export const adminUpdateBooklet = (id, data) => api.put(`/admin/booklets/${id}`, data);
export const adminDeleteBooklet = (id) => api.delete(`/admin/booklets/${id}`);

// Schools
export const adminGetSchools = () => api.get('/admin/schools');

// Orders
export const adminGetOrders = (params) => api.get('/admin/orders/details', { params });
export const adminUpdateOrderStatus = (id, data) => api.put(`/admin/orders/${id}/status`, data);

// Order search
export const adminSearchOrderByID = (id) => api.get('/admin/orders/search/by-id', { params: { id } });
export const adminSearchOrdersByStudentName = (name) => api.get('/admin/orders/search/by-student', { params: { name } });
export const adminSearchOrdersByBookletTitle = (title) => api.get('/admin/orders/search/by-booklet', { params: { title } });
