import { prisma } from '../lib/prisma.js';

export class ProgressService {
  async getProgressSummary({ schoolId }) {
    const where = schoolId ? { schoolId } : {};
    const booklets = await prisma.booklet.findMany({
      where,
      include: { course: true, school: true },
      orderBy: { title: 'asc' },
    });

    return Promise.all(
      booklets.map(async (booklet) => {
        const [completed, pending, activeOrders] = await Promise.all([
          prisma.studentBookletProgress.count({
            where: { bookletId: booklet.id, status: 'completed' },
          }),
          prisma.studentBookletProgress.count({
            where: { bookletId: booklet.id, status: 'pending' },
          }),
          prisma.orderItem.count({
            where: {
              bookletId: booklet.id,
              status: { in: ['pending', 'ready'] },
            },
          }),
        ]);
        const total = completed + pending;
        return {
          booklet_id: booklet.id,
          booklet_title: booklet.title,
          course_name: booklet.course.name,
          school_name: booklet.school.name,
          total_students: total,
          completed,
          pending,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          printed_quantity: booklet.printedQuantity,
          active_orders: activeOrders,
          faltantes: Math.max(0, activeOrders - booklet.printedQuantity),
        };
      })
    );
  }

  async getBookletStudents(bookletId) {
    const booklet = await prisma.booklet.findUnique({
      where: { id: bookletId },
      include: { course: { select: { name: true } } },
    });
    if (!booklet) {
      const err = new Error('booklet not found');
      err.code = 'PROG_001';
      err.status = 404;
      throw err;
    }

    const records = await prisma.studentBookletProgress.findMany({
      where: { bookletId },
      include: {
        student: { select: { id: true, name: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });

    return {
      booklet_id: booklet.id,
      booklet_title: booklet.title,
      students: records.map((r) => ({
        progress_id: r.id,
        student_id: r.student.id,
        student_name: r.student.name,
        status: r.status,
        updated_at: r.updatedAt,
      })),
    };
  }

  async updateProgress(id, status) {
    if (!['pending', 'completed'].includes(status)) {
      const err = new Error('invalid status value');
      err.code = 'PROG_002';
      err.status = 400;
      throw err;
    }

    const record = await prisma.studentBookletProgress.findUnique({
      where: { id },
    });
    if (!record) {
      const err = new Error('progress record not found');
      err.code = 'PROG_003';
      err.status = 404;
      throw err;
    }

    const updated = await prisma.studentBookletProgress.update({
      where: { id },
      data: { status },
      select: { id: true, studentId: true, bookletId: true, status: true },
    });

    return {
      id: updated.id,
      student_id: updated.studentId,
      booklet_id: updated.bookletId,
      status: updated.status,
    };
  }

  async setPrintedQuantity(bookletId, quantity) {
    if (!Number.isInteger(quantity) || quantity < 0) {
      const err = new Error('quantity must be a non-negative integer');
      err.code = 'PROG_004';
      err.status = 400;
      throw err;
    }

    const booklet = await prisma.booklet.findUnique({ where: { id: bookletId } });
    if (!booklet) {
      const err = new Error('booklet not found');
      err.code = 'PROG_001';
      err.status = 404;
      throw err;
    }

    return prisma.booklet.update({
      where: { id: bookletId },
      data: { printedQuantity: quantity },
      select: { id: true, printedQuantity: true },
    });
  }
}
