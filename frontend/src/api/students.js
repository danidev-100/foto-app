import api from './client';

export function listStudents(page = 1, perPage = 20) {
  return api.get('/admin/students', { params: { page, per_page: perPage } });
}

export function updateStudent(id, data) {
  return api.patch(`/admin/students/${id}`, data);
}
