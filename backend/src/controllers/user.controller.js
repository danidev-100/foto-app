import { prisma } from '../lib/prisma.js';
import { successJSON, errorJSON, paginatedJSON } from '../lib/response.js';

export class UserController {
  async listStudents(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.per_page, 10) || 20, 1), 100);

      const [students, total] = await Promise.all([
        prisma.student.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true, name: true, email: true, phone: true,
            courseId: true, isAdmin: true, isActive: true,
            createdAt: true, updatedAt: true,
          },
        }),
        prisma.student.count(),
      ]);

      return paginatedJSON(res, students, page, limit, total);
    } catch (err) {
      console.error('ListStudents error:', err);
      return errorJSON(res, 500, 'INF_001', 'failed to list students');
    }
  }

  async updateStudent(req, res) {
    try {
      const student = await prisma.student.findUnique({ where: { id: req.params.id } });
      if (!student) {
        return errorJSON(res, 404, 'USR_001', 'student not found');
      }

      const { is_admin: isAdmin, is_active: isActive } = req.body;
      const updateData = {};
      if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await prisma.student.update({
        where: { id: req.params.id },
        data: updateData,
        select: {
          id: true, name: true, email: true, phone: true,
          courseId: true, isAdmin: true, isActive: true,
          createdAt: true, updatedAt: true,
        },
      });

      return successJSON(res, 200, updated);
    } catch (err) {
      console.error('UpdateStudent error:', err);
      return errorJSON(res, 500, 'INF_001', 'failed to update student');
    }
  }
}
