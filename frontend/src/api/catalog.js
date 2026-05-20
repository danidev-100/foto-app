import api from './client';

export const getBooklets = (params) => api.get('/catalog/booklets', { params });
export const getBooklet = (id) => api.get(`/catalog/booklets/${id}`);
export const getCourses = () => api.get('/catalog/courses');
export const getDivisionsByCourse = (courseId) => api.get(`/catalog/courses/${courseId}/divisions`);
