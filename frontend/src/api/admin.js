import api from './client';

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
